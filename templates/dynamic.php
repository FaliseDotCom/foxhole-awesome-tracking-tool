<script type="text/html" id="tmplDynamic">
  <svg>
    <% for ( var i=0; i<items.length; i++ ) { %>
      <%
        var item = items[ i ],
            x = item.x * 1024,
            y = item.y * 888,
            icon = getIcon( item.i ),
            w = 20,
            h = 20;
        %>
      <svg x="<%= x - w/2 %>px" y="<%= y - h/2 %>px" width="<%= w %>px" height="<%= h %>px">
        <image href="<%= icon %>" width="<%= w %>px" height="<%= h %>px" class="<%= item.t %>"/>
      </svg>
   <% } %>
  </svg>
</script>
