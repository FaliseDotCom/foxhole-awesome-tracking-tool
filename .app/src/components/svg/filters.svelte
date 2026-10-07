<script>
  /* 
    Add this to the top of your svg 
    use filter="url(#colonial)" or class="colonial" on your svg element ( such as image )
    or use style="filter:url(#colonial);" or class="colonial" on your html element
    */
</script>

<defs>
  <style type="text/css">
      .sulphur    { filter: url( #sulphur ); }
      .coal       { filter: url( #coal ); }
      .oil        { filter: url( #oil ); }
      .component  { filter: url( #component ); }
      .warden     { filter: url( #warden ); }
      .colonial   { filter: url( #colonial ); }
      .salvage    { filter: url( #colonial ); }
  </style>

  <filter id="sulphur">
    <feColorMatrix
      type="matrix"
      values=" 1  2  2  0  0
              0  1  2  0  0
              0  0  0  0  0
              0  0  0  1  0">
    </feColorMatrix>
  </filter>

  <filter id="warden-bright-blue">
    <feColorMatrix
      type="matrix"
      values=" 0.500  0.000  0.000  0.000 -0.300
              0.000  0.900  0.000  0.000 -0.100
              2.000  1.000  9.000  0.000 -0.300
              0.000  0.000  0.000  1.000  0.000">
    </feColorMatrix>
  </filter>

  <filter id="colonial-bright-green">
    <feColorMatrix
      type="matrix"
      values=" 1.000 -0.100  0.000  0.000 -0.200
              -1.400 -1.700  9.000 -0.100  0.000
              -0.600  0.000  1.500 -0.400  0.000
              0.300  4.000  0.000  1.700 -0.500">
    </feColorMatrix>
  </filter>

  <filter id="pink">
    <feColorMatrix
      type="matrix"
      values=" 5.000  5.000  5.000  2.000 -1.300
              0.000  1.000  0.000  0.000  0.000
              0.000 -0.500  1.400  0.000  0.000
              1.200  2.900  0.500  4.700 -0.700">
    </feColorMatrix>
  </filter>

  <filter id="oil">
    <feColorMatrix
      type="matrix"
      values=" 1.400  0.000 -0.300 -0.200  0.000
              -0.100  1.100 -0.600 -0.300 -0.300
              0.300 -0.600  0.500 -0.800 -2.400
              4.600  0.200 -1.600  1.200 -0.300">
    </feColorMatrix>
  </filter>

  <filter id="components">
    <feColorMatrix
      type="matrix"
      values=" 0.400  0.000  0.000  0.000  0.000
              0.000  0.400  0.000  0.000  0.000
              0.000  0.000  0.400  0.000  0.000
              -0.100 -0.100 -0.100  1.300  0.000">
    </feColorMatrix>
  </filter>

  <filter id="salvage">
    <feColorMatrix
      type="matrix"
        values=" 1.000 -0.400 -0.100 -0.100  0.000
            -0.200  1.000 -0.600  0.000  0.000
            -0.300 -0.500  1.000 -0.600  0.100
            0.000  0.200 -0.300  1.000  0.000">
    </feColorMatrix>
  </filter>

  <filter id="warden">
    <feColorMatrix
      type="matrix"
      values=" 0.500 -0.400 -0.300 -0.100  0.000
              -0.400  0.500  0.000  0.000  0.000
              0.000  0.000  0.500  0.000  0.000
              0.000  0.000  0.000  1.000  0.000">
    </feColorMatrix>
  </filter>

  <filter id="colonial">
    <feColorMatrix
      type="matrix"
      values=" 0.500  0.100 -0.800 -0.100 -0.400
              -0.100  0.500 -0.200  0.000  0.000
              -0.500  0.000  0.500 -0.600 -0.400
              0.000  0.000  0.000  1.000  0.000">
    </feColorMatrix>
  </filter>

  <filter id="coal">
    <feColorMatrix
      type="matrix"
      values=" 0.040  0.000  0.000  0.000  0.000
              0.040  0.000  0.000  0.000  0.000
              0.040  0.000  0.000  0.000  0.000
              0.000  0.000  0.000  1.000  0.000">
    </feColorMatrix>
  </filter>
</defs>