<script>
  import { dev } from '$app/env';

  // clear console between hot reloads
  if ( dev && import.meta.hot) 
  {
    import.meta.hot.on(
      "vite:beforeUpdate",
      () => console.clear()
    );
  }
</script>