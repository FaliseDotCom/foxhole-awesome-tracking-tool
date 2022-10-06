<script type="text/html" id="tmplStatic">
  <svg>
    <% for ( var i=0; i<mapTextItems.length; i++ ) { %>
      <% var x = mapTextItems[i].x * 1024; %>
      <% var y = mapTextItems[i].y * 888; %>
      <text x="<%= x %>" y="<%= y %>" dominant-baseline="middle" text-anchor="middle"><%= mapTextItems[i].text %></text>
    <% } %>
  </svg>
</script>
