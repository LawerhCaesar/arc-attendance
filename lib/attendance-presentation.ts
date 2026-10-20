import type { RosterAttendanceColor } from './roster-attendance';
import type { RosterColorFilter } from './roster-view';

export const attendanceStyles: Record<RosterAttendanceColor, {row:string;badge:string;label:string}> = {
  green:{row:'bg-green-50 hover:bg-green-100',badge:'border-green-300 bg-green-100 text-green-900',label:'Regular'},
  yellow:{row:'bg-yellow-50 hover:bg-yellow-100',badge:'border-yellow-300 bg-yellow-100 text-yellow-900',label:'Inconsistent'},
  red:{row:'bg-red-50 hover:bg-red-100',badge:'border-red-300 bg-red-100 text-red-900',label:'No attendance'},
  unavailable:{row:'hover:bg-gray-50',badge:'border-gray-200 bg-gray-100 text-gray-700',label:'Unavailable'},
  archived:{row:'bg-gray-50 hover:bg-gray-100',badge:'border-gray-300 bg-gray-200 text-gray-700',label:'Excluded'},
};
export const attendanceColorFilters: {key:RosterColorFilter;label:string;style:string}[] = [
  {key:'all',label:'All colors',style:'border-gray-300 bg-white text-gray-800'},
  {key:'green',label:'Green · 4–8 services',style:'border-green-300 bg-green-100 text-green-900'},
  {key:'yellow',label:'Yellow · 1–3 services',style:'border-yellow-300 bg-yellow-100 text-yellow-900'},
  {key:'red',label:'Red · 0 services',style:'border-red-300 bg-red-100 text-red-900'},
  {key:'gray',label:'Gray · archived / unavailable',style:'border-gray-300 bg-gray-100 text-gray-700'},
];
