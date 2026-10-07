<?php

// runtime directories, created on first use and not served (the web root hides dot folders);
// data/ holds the war log database, keep it when deploying
define( 'LOG_DIR',   __DIR__ . '/logs/' );
define( 'CACHE_DIR', __DIR__ . '/cache/' );
define( 'DATA_DIR',  __DIR__ . '/data/' );
