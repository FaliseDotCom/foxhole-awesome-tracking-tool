<?php
    header( "Content-type: text/css" );

    require_once( __DIR__ ' ../../lib/icons.php' );

    $icons = Icons::getIcons();

    foreach ( $icons as $id => $path )
    {
        echo '#map .item.icon-' . $id . ' { background-image: url( ' . $path . ' ); } ';
        //echo '#maps .hex-pop .item.team-WARDENS.icon-' . $id . ' { background-image: url( ' . $path . ' ), url( ' . Icons::getWardenIcon( $path ) . ' ); } ';
        // echo '#maps .hex-pop .item.team-COLONIALS.icon-' . $id . ' { background-image: url( ' . $path  . '), url( ' . $Icons::getWColonialIcon( $path )  . ' ); } ';
    }
?>