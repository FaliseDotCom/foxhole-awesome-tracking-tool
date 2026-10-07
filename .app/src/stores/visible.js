import { writable } from 'svelte/store';
import { grid } from '@stores/grid'

// init store
let visibles = { rows: [], cols: [] }
const { subscribe, set } = writable( visibles )

// get hex visibility
const getVisible = name =>
{
  // get item from world data
  const item = name in grid.world ? grid.world[ name ] : null;
  // check if item exists and visible object contains items row and col
  if ( item && visibles.rows.length >= item.row && visibles.cols.length >= item.col )
  {
    return visibles.rows[ item.row ] && visibles.cols[ item.cols ];
  }
  // if item wasn't found, always show it
  return true;
}

// calculate column and row visibilities
const setVisible = t =>
{       
        // window width & height
  const ww = window.innerWidth,
        wh = window.innerHeight,
        // absolute column width and row height values
        cw = grid.item_width * t.scale,
        rh = grid.item_height * t.scale,
        // out of screen offset
        offset = 100;

  // calculate column visibility
  for ( let i=0; i<=grid.cols; i++ )
  {
    const left = t.x + i * cw / grid.column_factor,
          right = left + cw;
    visibles.cols[ i ] = right >= -offset && left <= ww + offset;
  }

  // calculate row visibility
  for ( let i=0; i<=grid.rows; i++ )
  {
    const top = t.y + i * rh / grid.row_factor,
          bottom = top + rh;
    visibles.rows[ i ] = bottom >= -offset && top <= wh + offset;
  }
 
  // update store
  set( visibles )
}
export const visible = {
  subscribe,
  getVisible,
  setVisible
};