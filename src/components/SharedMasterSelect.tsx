import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { filterSharedMasterOptions } from "@/lib/shared-master-options";
export function SharedMasterSelect({label,options,value,onChange,required=false,disabled=false}:{label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void;required?:boolean;disabled?:boolean}) {
 const [open,setOpen]=useState(false),[search,setSearch]=useState("");
 const filteredOptions=filterSharedMasterOptions(options,search);
 const close=()=>{setOpen(false);setSearch("");};
 return <div className="relative min-w-0 w-full"><Popover open={disabled?false:open} onOpenChange={nextOpen=>{setOpen(nextOpen);if(!nextOpen)setSearch("");}}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} disabled={disabled} className="w-full min-w-0 justify-between font-normal"><span className="min-w-0 truncate">{options.find(o=>o.value===value)?.label || (value ? `Existing value: ${value}` : `Search ${label.toLowerCase()}…`)}</span><span aria-hidden="true">⌄</span></Button></PopoverTrigger><PopoverContent className="w-80 p-0" align="start"><Command shouldFilter={false}><CommandInput placeholder={`Search ${label.toLowerCase()}…`} value={search} onValueChange={setSearch}/><CommandList><CommandEmpty>No matching entries available within your access.</CommandEmpty><CommandItem value="Clear selection" onSelect={()=>{onChange("");close();}}>Clear selection</CommandItem>{filteredOptions.map(o=><CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={()=>{onChange(o.value);close();}}>{o.label}</CommandItem>)}</CommandList></Command></PopoverContent></Popover><input aria-label={`${label} selection`} className="absolute h-px w-px opacity-0" tabIndex={-1} required={required} value={value} onChange={()=>{}}/></div>;
}
