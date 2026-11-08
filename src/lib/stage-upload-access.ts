/** Parallel stages are ordered by their saved dependencies, never by catalogue row position. */
export function stageUploadAllowed(stages:readonly {code:string;prerequisites?:readonly string[]}[],current:string,target:string,activated:readonly string[]=[]):boolean {
  const from=stages.find(stage=>stage.code===current),to=stages.find(stage=>stage.code===target);
  if(!from||!to)return false;
  return current===target || !!from.prerequisites?.includes(target) || activated.includes(target);
}
