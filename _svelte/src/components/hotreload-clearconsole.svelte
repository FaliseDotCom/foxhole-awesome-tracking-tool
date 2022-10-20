<script>
  // clear console between hot reloads
  if (import.meta.hot) 
  {
    import.meta.hot.on(
      "vite:beforeUpdate",
      /* eslint-disable-next-line no-console */
      () => console.clear()
    );
  }
</script>