import { writable} from 'svelte/store';

const store = writable( 1 ),
      min = .1,
      max = 5,
      step = .2

export const zoom = {
  ...store,
  min,
  max,
  step
};