import { writable} from 'svelte/store';

const store = writable( 1 ),
      min = .5,
      max = 10;

export const zoom = {
  ...store,
  min,
  max
};