<script type="text/html" id="tmplMap">
  <div id="<%= name %>" class="hex">
    <img class="map" src="/assets/images/maps/Map<%= name %>Hex.png" alt="<%= title %>"/>
    <h4 class="title"><%= title %></h4>
    <% for ( var i=0; i<mapTextItems.length; i++ ) { %>
      <div class="item static <%= mapTextItems[i].mapMarkerType %>" style="left: <%= mapTextItems[i].x * 100 %>%; top: <%= mapTextItems[i].y * 100 %>%;">
        <div class="label"><%= mapTextItems[i].text %></div>
      </div>
    <% } %>
    <% for ( var i=0; i<mapItems.length; i++ ) { %>
      <div class="item dynamic icon-<%= mapItems[i].iconType %> team-<%= mapItems[i].teamId %>" style="left: <%= mapItems[i].x * 100 %>%; top: <%= mapItems[i].y * 100 %>%;"></div>
    <% } %>
  </div>
</script>
