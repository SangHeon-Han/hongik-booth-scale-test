import {clone,initialState,validate} from './model.js';

export function createProject(scene=initialState()) {
  return {format:'hicd-project',version:1,active:'A',layouts:{A:validate(scene),B:null}};
}
export function validateProject(raw) {
  if(raw?.format!=='hicd-project')return createProject(validate(raw));
  if(raw.version!==1||!['A','B'].includes(raw.active)||!raw.layouts?.A||!Object.hasOwn(raw.layouts,'B'))throw new Error('A/B 배치 파일 형식이 올바르지 않습니다.');
  const layouts={A:validate(raw.layouts.A),B:raw.layouts.B===null?null:validate(raw.layouts.B)};
  if(!layouts[raw.active])throw new Error('선택된 배치가 없습니다.');
  return {format:'hicd-project',version:1,active:raw.active,layouts};
}
export function switchLayout(project,target) {
  if(!['A','B'].includes(target))throw new Error('알 수 없는 배치입니다.');
  if(!project.layouts[target])project.layouts[target]=clone(project.layouts[project.active]);
  project.active=target;
  return project.layouts[target];
}
export function copyLayout(project) {
  const target=project.active==='A'?'B':'A';
  project.layouts[target]=clone(project.layouts[project.active]);return target;
}
