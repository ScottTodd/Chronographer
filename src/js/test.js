"use strict";

var three = require('three');
var d3 = require('d3');

console.log('Hello world from test.js!');

window.onload = function() {

    var renderer = new three.WebGLRenderer();
    renderer.setSize( 800, 600 );
    document.body.appendChild( renderer.domElement );

    var scene = new three.Scene();

    var camera = new three.PerspectiveCamera(
        35,             // Field of view
        800 / 600,      // Aspect ratio
        0.1,            // Near plane
        10000           // Far plane
    );
    camera.position.set( -15, 10, 10 );
    camera.lookAt( scene.position );

    var geometry = new three.CubeGeometry( 5, 5, 5 );
    var material = new three.MeshLambertMaterial( { color: 0xCC4444 } );
    var mesh = new three.Mesh( geometry, material );
    scene.add( mesh );

    var light = new three.PointLight( 0xFFFF00 );
    light.position.set( 10, 0, 10 );
    scene.add( light );

    renderer.render( scene, camera );

    d3.select("body").transition()
        .style("background-color", "black");
};
