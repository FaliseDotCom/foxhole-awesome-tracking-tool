<?php

// runtime directories, created on first use and not served (the web root hides dot folders);
// data/ holds the war log database, keep it when deploying; the logs are in .logs/ in the web
// root, one folder per day
define( 'LOG_DIR',   dirname( __DIR__ ) . '/.logs/' );
define( 'CACHE_DIR', __DIR__ . '/cache/' );
define( 'DATA_DIR',  __DIR__ . '/data/' );

// server settings (lib/env.php), only on the server: not in the repository and not deployed
define( 'ENV_FILE',  __DIR__ . '/.env' );

// the same time zone for the website and cron (the command line PHP may default to UTC), so log
// lines and day folders agree
date_default_timezone_set( 'Europe/Amsterdam' );
