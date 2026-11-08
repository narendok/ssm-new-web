"""Read the supplied lifecycle reference without executing formulas or editing it."""
import json
import tempfile
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

source = Path(r'C:\Users\Admin\Downloads\New Hexa Format.xlsx')
destination = Path(tempfile.gettempdir()) / 'ssm-one-web-test-artifacts' / 'new-hexa-source.json'
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with ZipFile(source) as archive:
    strings = []
    if 'xl/sharedStrings.xml' in archive.namelist():
        strings = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', ns)]
    relationships = {node.attrib['Id']: node.attrib['Target'] for node in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
    sheets = []
    for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall('s:sheets/s:sheet', ns):
        relationship = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = relationships[relationship]
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        root = ET.fromstring(archive.read(target))
        rows = []
        for row in root.findall('s:sheetData/s:row', ns):
            cells = {}
            for cell in row.findall('s:c', ns):
                value = cell.findtext('s:v', default='', namespaces=ns)
                if cell.attrib.get('t') == 's':
                    value = strings[int(value)] if value else ''
                elif cell.attrib.get('t') == 'inlineStr':
                    value = ''.join(cell.find('s:is', ns).itertext())
                if value:
                    cells[cell.attrib['r']] = value
                formula = cell.findtext('s:f', namespaces=ns)
                if formula:
                    cells[cell.attrib['r'] + ':formula'] = formula
            if cells:
                rows.append({'row': int(row.attrib['r']), 'cells': cells})
        dimension = root.find('s:dimension', ns)
        sheets.append({'name': sheet.attrib['name'], 'range': dimension.attrib.get('ref') if dimension is not None else None, 'merged': [m.attrib['ref'] for m in root.findall('s:mergeCells/s:mergeCell', ns)], 'rows': rows})
result = {'source': str(source), 'sheets': sheets}
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
for sheet in sheets:
    print(json.dumps({'name':sheet['name'],'range':sheet['range'],'nonemptyRows':len(sheet['rows']),'firstRows':sheet['rows'][:12]},ensure_ascii=True))
