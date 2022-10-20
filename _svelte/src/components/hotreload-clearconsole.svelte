<script>
  import { dev } from '$app/environment';

  // clear console between hot reloads
  if ( dev && import.meta.hot) 
  {
    import.meta.hot.on(
      "vite:beforeUpdate",
      /* eslint-disable-next-line no-console */
      () => console.clear()
    );
  }
</script>