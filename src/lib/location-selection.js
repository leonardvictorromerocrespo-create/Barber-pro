import {coordinates} from './catalog.js';
export function initialLocation(point,saved=false){
 const valid=saved?coordinates(point):null;
 return {status:valid?'saved':'empty',point:valid,candidate:null,error:''};
}
export function locationReady(state){return ['saved','selected'].includes(state.status)&&Boolean(coordinates(state.point));}
export function selectLocation(state,action){
 if(action.type==='start')return {status:'locating',point:null,candidate:null,error:''};
 if(action.type==='failed')return {status:'empty',point:null,candidate:null,error:action.message};
 if(action.type==='manual'||action.type==='found'){
  const point=coordinates(action.point);
  if(!point)return {status:'empty',point:null,candidate:null,error:'No se obtuvo una ubicación válida. Elige el local en el mapa.'};
  return action.type==='manual'?{status:'selected',point,candidate:null,error:''}:{status:'candidate',point:null,candidate:point,error:''};
 }
 if(action.type==='confirm'&&state.status==='candidate'&&coordinates(state.candidate))return {status:'selected',point:state.candidate,candidate:null,error:''};
 return state;
}
