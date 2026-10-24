import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
export function SharedSupplierSelect({options,value,onChange}:{options:{value:string;label:string}[];value:string;onChange:(value:string)=>void}) {
 const [open,setOpen]=useState(false);
 return <div className="grid gap-1">
   <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label="Supplier" aria-expanded={open} className="w-full justify-between font-normal">{options.find(option=>option.value===value)?.label || (value ? `Existing supplier: ${value}` : "Search suppliers…")}<span aria-hidden="true">⌄</span></Button></PopoverTrigger>
   <PopoverContent className="w-80 p-0" align="start"><Command><CommandInput placeholder="Search supplier name or code…"/><CommandList><CommandEmpty>{options.length ? "No matching suppliers." : "No shared supplier master records available."}</CommandEmpty><CommandItem value="No supplier selected" onSelect={()=>{onChange("");setOpen(false);}}>No supplier selected</CommandItem>{options.map(option=><CommandItem key={option.value} value={option.label} onSelect={()=>{onChange(option.value);setOpen(false);}}>{option.label}</CommandItem>)}</CommandList></Command></PopoverContent></Popover>
   {!options.length && <span className="text-xs text-muted-foreground">Shared supplier master is not connected. No DEMO suppliers are used.</span>}
 </div>;
}
