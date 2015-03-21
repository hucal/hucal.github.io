// D3 globals
var container, stats, controls;
var camera, scene, renderer;

var raycaster;
var mouse;

// user config, level difficulty
var config =
  { n: 15,
    box_size: 30,
    quit: false,
    clear_color: "white",
    nice_shading: true
  };

// lol @ globals
var grid_objects = [];

var __c = 0.9;
var block_geometry = new THREE.BoxGeometry(
        __c * config.box_size, __c * config.box_size, __c * config.box_size );

var crateTexture = THREE.ImageUtils.loadTexture(
        'textures/crate.gif' );
var arrowTexture = THREE.ImageUtils.loadTexture(
        'textures/crate-arrow.gif' );

function init() {
    container = document.getElementById( 'container' );

    renderer = new THREE.WebGLRenderer( {antialias: true } );
    renderer.setClearColor( config.clear_color );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild(renderer.domElement);

    // CAMERA
    camera = new THREE.PerspectiveCamera( 70,
            window.innerWidth / window.innerHeight, 1, 3000 );
    camera.position.y = 300;
    camera.position.z = 500;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.target.set( 0, 0, 0 );

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );

    document.addEventListener( 'mouseup', onDocumentMouseUp, false );
    document.addEventListener( 'touchend', onDocumentTouchEnd, false );
    document.addEventListener( 'touchstart', onDocumentTouchStart, false );

    window.addEventListener( 'resize', onWindowResize, false );

}

function init_level(config) {
    config.quit = false;
    grid_objects = [];

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog( config.clear_color, 1000, 3000 );

    if (config.nice_shading) {
        var hemi = new THREE.HemisphereLight(
            0xffffff, 0xffffff, 1.2
        );
        hemi.color.setHSL( 0.6, 1, 0.75 );
        hemi.groundColor.setHSL( 0.1, 0.8, 0.7 );
        hemi.position.y = 2000;

        scene.add( hemi );
    }

    for ( var x = 0; x < config.n; x ++ ) {
    for ( var y = 0; y < config.n; y ++ ) {
    for ( var z = 0; z < config.n; z ++ ) {
        var material;
        var arrow_block;
        var block = new Block(x, y, z);

        if (block.mesh !== undefined)
            scene.add( block.mesh );
    }
    }
    }

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function onDocumentTouchStart( e ) {
    onDocumentTouchEnd( e );
}

function onDocumentTouchEnd( event ) {

    event.preventDefault();

    event.clientX = event.touches[0].clientX;
    event.clientY = event.touches[0].clientY;
    onDocumentMouseDown( event );

}

function onDocumentMouseUp( event ) {

    if (config.quit) { return; }

    event.preventDefault();

    mouse.x = ( event.clientX / renderer.domElement.width ) * 2 - 1;
    mouse.y = - ( event.clientY / renderer.domElement.height ) * 2 + 1;

    raycaster.setFromCamera( mouse, camera );

    var intersects = raycaster.intersectObjects( scene.children );

    if ( intersects.length > 0 ) {

        var obj = intersects[ 0 ].object;

        retrieve_object(to_grid(obj.position)).click();

    }
}

//

function animate() {

    requestAnimationFrame( animate );

    render();
    stats.update();

}

var radius = 600;
var theta = 0;

function render() {

    TWEEN.update();

    controls.update();

    renderer.render( scene, camera );

}



/**************** Block object ************/

// instantiate:
// var b = new Block(THREE.js Mesh)
var Block = function (x, y, z) {
    var material;
    var col = new THREE.Color( x/config.n, y/config.n, z/config.n );

    // actions and behavior

    this.arrow_block = Math.random() < 0.2;
    this.breakable = !this.arrow_block && Math.random() < 0.2;
    this.winner = x == 0 && y == 0 && z == 0;

    this.dir_neg = Math.random > 0.5 ? -1 : 1;
    this.dir = ["x", "y", "z"][Math.floor(Math.random() * 3)];

    // no unbreakable blocks visible...
    //if (!this.breakable && !this.winner && !this.arrow_block) {

    //    return;

    //}

    this.create(col);

    place_object(this, x, y, z);
};

// separated Block(), which selects random properties, from create() to allow
// custom block configurations and positions.
Block.prototype.create = function(col) {
    this.onactive = this.winner ? [win] : [fly_away];
    this.onclick = [];
    this.hp = 1;
    if (this.arrow_block) {
        this.onclick = [actions.pulse];
        this.onactive = [actions.pulse];
    }
    else if (this.breakable) {
        this.hp = 3;
        this.onclick = [actions.break_self];
    }
    else if (this.winner) {
        this.onclick = [win];
    }

    // LOOKS. pick material
    if (config.nice_shading) {

        material = new THREE.MeshPhongMaterial(

                { //map: texture,
                  shininess: 1, color: col });
    } else {

        material = new THREE.MeshBasicMaterial(

                { //map: texture,
                  color: col });
    }

    if (this.arrow_block) {

        // lighter
        col.multiplyScalar(2);

        //create arrow material
        var arrMat;

        if (config.nice_shading) {

            arrMat = new THREE.MeshPhongMaterial(
                    {map: arrowTexture, shininess: 1, color: col});

            crateMat = new THREE.MeshPhongMaterial(
                    {map: crateTexture, shininess: 1, color: col});

        } else {

            arrMat = new THREE.MeshBasicMaterial(
                    {map: arrowTexture, shininess: 1, color: col});

            crateMat = new THREE.MeshBasicMaterial(
                    {map: crateTexture, shininess: 1, color: col});

        }

        // ???
        // how to do this...
        // top + bottom faces should have no arrow
        // all other faces should have arrow pointing the same way
        material = new THREE.MeshFaceMaterial([
                arrMat, crateMat, arrMat, crateMat, arrMat, arrMat
        ]);


    }
    else {
        if (!this.breakable) {
            material.color.multiplyScalar(0.5);
        }
    }
    if (this.winner) {
        material.color = new THREE.Color("gold");
    }

    this.mesh = new THREE.Mesh( block_geometry, material );

    // ???
    // should resolve texture problem
    if (this.arrow_block) {
        this.mesh.rotation[this.dir] = this.dir_neg < 0 ?
                  Math.PI / 2
                : Math.PI;
    }
}

// method click(), called when user clicks block
Block.prototype.click = function() {

        // invert color
        if (!this.arrow_block || this.mesh.material.color !== undefined) {
            this.mesh.material.color.multiplyScalar(-1);
            this.mesh.material.color.addScalar(1);
        }

        // run each action
        var b = this;
        this.onclick.forEach(function (f){ f(b); });
}

Block.prototype.activate = function() {
    var b = this;
    this.onactive.forEach(function (f){ f(b); });
}



function fly_away(b) {
    if (b.winner) {
        return;
    }
    new TWEEN.Tween( b.mesh.position ).to( {
        x: 3100 * Math.sign(b.mesh.position.x),
        y: 3100 * Math.sign(b.mesh.position.y),
        z: 3100 * Math.sign(b.mesh.position.z)}
        , 20000 )

    .easing( TWEEN.Easing.Elastic.Out).start();

    remove_object(b.mesh.position);
}

function break_self(b) {
    b.hp -= 1;
    if (b.hp <= 0) {
        fly_away(b);
    }
}

function scale_to(b, scale) {
    new TWEEN.Tween( b.mesh.scale ).to( {
        x: scale,
        y: scale,
        z: scale
        } , 1000 )
    .easing( TWEEN.Easing.Elastic.Out).start();
}

function win(b) {
    scale_to(b, config.n * 3);

    document.getElementById("info").innerHTML = "YOU WIN! " +
        "<a href=\"javascript:window.location.reload(false);\">"
        + "PLAY AGAIN?</a>";

    // zoom out
    new TWEEN.Tween( camera.position ).to( {
        x: camera.position.x * 3,
        y: camera.position.y * 3,
        z: camera.position.z * 3}
        , 300 )
    .easing( TWEEN.Easing.Elastic.Out).start();

    config.quit = true;
}


//Activator blocks send pulse that activates other blocks.
//Note: The block may fire because it's clicked on OR because another block
//activated it, resulting in a chain
function pulse(b) {
    // ms to vanish
    var laser_go_away = 1 * 1000;

    var cs = to_grid(b.mesh.position);

    var neighbor;

    var blocks_away = 1;

    // clone() for objects?
    var search = { x: cs.x, y: cs.y, z: cs.z };

    // TODO DEBUG ME...
    // may select neghbor on the opposite end of the cube
    // may not select neighbor at all, although one is available along
    // the b.dir axis
    for (; search[b.dir] >= 0 && search[b.dir] <= config.n; blocks_away++) {

        // fetch object along the laser's path
        search[b.dir] += b.dir_neg;

        neighbor = retrieve_object(search);

        if (neighbor !== undefined) {

            setTimeout(function()

                    {
                      neighbor.onactive.forEach(function(f) {f(neighbor)});

                      fly_away(neighbor) }, laser_go_away * (1 + Math.random()));

            break;
        }
    }

    // translate to pulse direction
    // or else the laser's tip will be halfway between "this" and the
    // neighbor
    cs[b.dir] += b.dir_neg * blocks_away / 2;

    var size = {}

    size.x = config.box_size * 1.5;
    size.y = size.x;
    size.z = size.x;

    // long in pulse direction
    size[b.dir] = config.box_size * blocks_away;

    var laser_geometry = new THREE.BoxGeometry(
            size.x, size.y, size.z);

    material = new THREE.MeshBasicMaterial(
        { shininess: 1, color: new THREE.Color("red") });

    lzr = new THREE.Mesh( laser_geometry, material );

    var actual_cs = from_grid(cs);

    lzr.position.x = actual_cs.x;
    lzr.position.y = actual_cs.y;
    lzr.position.z = actual_cs.z;

    scene.add( lzr );

    var scale_transform = { x: 0.1, y: 0.1, z: 0.1 };

    scale_transform[b.dir] = 1;

    new TWEEN.Tween( lzr.scale ).to( scale_transform, laser_go_away )
    .easing( TWEEN.Easing.Elastic.Out).start();

    setTimeout(function() { fly_away(b) ; scene.remove(lzr) }, laser_go_away);
}

function boom(b) {
    var cs = to_grid(b.mesh.position);

    // clear out a 3x3 cube
    for (var xoff = -1; xoff <= 1; xoff++ ) {

    for (var yoff = -1; yoff <= 1; yoff++ ) {

    for (var zoff = -1; zoff <= 1; zoff++ ) {

        neighbor = retrieve_object(
                { x: cs.x + xoff, y: cs.y + yoff, z: cs.z + zoff });

        if (neighbor !== undefined) {

            fly_away(neighbor);

        }
    }
    }
    }

    fly_away(b);
}



// each of these takes a Block mesh as the first argument
// Haskell style commas OHYEA
var actions = { boom: boom

              , pulse: pulse

              , break_self: break_self

              , shrink: function(b) { scale_to(b, 0.1); }
              };

function random_action() {
    // http://stackoverflow.com/questions/2532218/
    // pick-random-property-from-a-javascript-meshect

    var keys = Object.keys(actions);

    return keys[ keys.length * Math.random() << 0];
}



/********** Block collection functions. **********/

// returns grid points of a "real-world" object
function to_grid(pos) {
    var box_size = config.box_size;
    var n = config.n;

    return {
        x: (pos.x + n * box_size / 2) / box_size,
        y: (pos.y + n * box_size / 2) / box_size,
        z: (pos.z + n * box_size / 2) / box_size
    }
}

// converts real coordinates into a gridded system
function from_grid(pos) {
        var box_size = config.box_size;
        var n = config.n;

        return {
            x: pos.x * box_size - n * box_size / 2,
            y: pos.y * box_size - n * box_size / 2,
            z: pos.z * box_size - n * box_size / 2
        };
}

function place_object(b, x, y, z) {

        var cs = from_grid({ x: x, y: y, z: z });

        b.mesh.position.x = cs.x;
        b.mesh.position.y = cs.y;
        b.mesh.position.z = cs.z;

        grid_objects[x + config.n * y + config.n * config.n * z] = b;

}

// p = position
function retrieve_object(p) {
    return grid_objects[p.x + config.n * p.y + config.n * config.n * p.z];
}

function remove_object(p) {
    grid_objects[p.x + config.n * p.y + config.n * config.n * p.z] = undefined;
}




init();
init_level(config);
animate();

