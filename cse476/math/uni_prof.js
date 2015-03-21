var visualization_svg;
var drawlinks = true;
var w = 950,
    h = 650;

var glob_conf = { projection: 'conic equidistant',
                  data: '../data/Gauss.json' };

var uni_radius = 1.5;
var link_width = 0.5;
var doc_radius = 0.75;

//
// Geographic projections
//
var projections = {
    'mercator': d3.geo.mercator()
        .scale((w + 1) / 2 / Math.PI)
        .translate([w / 2, h / 2]),

    'waterman': d3.geo.polyhedron.waterman()
        .rotate([20, 0])
        .scale(118)
        .translate([w / 2, h / 2]),

    'conic equidistant': d3.geo.conicEquidistant([10, 80])
        .center([0, 15])
        .scale(128)
        .translate([w / 2, h / 2]),

    'equirectangular': d3.geo.equirectangular()
        .scale(153)
        .translate([w / 2, h / 2])
};

json_files = ['Gauss', 'Laplace', 'Zygmund']
    .map(function (e) { return '../data/' + e + '.json'; });

//
// Render a JSON file using a given map projection.
//
function render(projection, data_fname) {

    var search = $('#search');

    var path = d3.geo.path()
        .projection(projection);

    var svg = d3.select('article').insert('svg')
        .attr('width', w)
        .attr('height', h);

    var g = svg.append('g');

    g.append('path')
        .datum({
            type: 'Sphere'
        })
        .attr('class', 'graticule outline')
        .attr('d', path);

    // draw world map
    d3.json('../data/world-110m2.json', function(error, topology) {

        // draw universities
        d3.json(data_fname, function(error, unis_n_docs) {
            if (error) {
                console.log(error);
                return;
            };
            docs_root = unis_n_docs.doctors_root;
            unis = unis_n_docs.universities;

            var hier = d3.layout.pack();
            var docs_list = hier.nodes(docs_root);
            var selected_docs = [];

            //
            // Utility functions
            //
            function doc_find_by_url(url) {
                var ds = docs_list.filter(function(d){
                    return d.url === url;
                });
                return ds.length > 0 ? ds[0] : null;
            };

            function node_find_by_name(name) {
                var ds = docs_list.filter(function(d){
                    return d.name === name;
                });
                ds.concat(
                    unis.filter(function(d){
                        return d.name === name;
                    }));
                return ds.length > 0 ? ds[0] : null;
            };


            // Thank you https://twitter.github.io/typeahead.js/examples/
            var name_matcher = function(nodes) {
            return function (q, cb) {
                    var matches, substrRegex;

                    // an array that will be populated with substring matches
                    matches = [];

                    // regex used to determine if a string contains the substring `q`
                    substrRegex = new RegExp(q, 'i');

                    //
                    // iterate through the pool of strings and for any string that
                    // contains the substring `q`, add it to the `matches` array
                    //
                    $.each(nodes, function(i, obj) {
                            if (substrRegex.test(obj.name)) {
                                // the typeahead jQuery plugin expects suggestions to a
                                // JavaScript object, refer to typeahead docs for more info
                                matches.push({ value: obj });
                            }
                    });

                    cb(matches);
                  };
            };

            //
            // Search for names.
            //
            $('#scrollable-dropdown-menu .typeahead').typeahead(
            {
              hint: true,
              highlight: true,
              minLength: 1
            },
            {
              name: 'universities',
              displayKey: function (o) { return o.value.name; },
              source: name_matcher(unis)
            },
            {
              name: 'doctors',
              displayKey: function (o) { return o.value.name; },
              source: name_matcher(docs_list)
            })
            .on("typeahead:selected", function(suggestion, obj, dataset) {
                var o = obj.value;
                if (o.nocoords) {
                    $('#warning').html(
                        'No coordinates available for: ' + o.name +
                        '\nSee ' + o.url);
                    setTimeout(function ()
                        {$('#warning').html('')}, 30 * 1000);
                } else {
                    var coords;
                    if (dataset === 'doctors') {
                        coords = [o.x_, o.y_];
                    } else {
                        coords = [o.x, o.y];
                    }
                    var indicator = g.append('circle')
                        .attr('class', 'search_highlight')
                        .attr('cx', coords[0])
                        .attr('cy', coords[1])
                        .attr('stroke-width', link_width)
                        .attr('stroke-width', '14')
                        .attr('stroke', 'black')
                        .attr('fill', 'none')
                        .attr('r', 10);
                    setTimeout(function ()
                        { indicator.remove() }, 60 * 1000);
                }
            });

            //
            // Assign somewhat-unique location to colliding points
            //
            var next_point = function () {

                var coords = unis.map(function(u) {
                    return {x: u.latitude, y: u.longitude, n: 1};
                });

                function coords_seen(x, y) {
                    for (var i = 0; i < coords.length; i++) {
                        if (x === coords[i].x && y === coords[i].y) {
                            return coords[i];
                        }
                    }
                    return null;
                }

                function f (center) {
                    var yoff = 0;
                    var xoff = 0;
                    var cs = coords_seen(center.x_, center.y_);
                    if (cs === null) {
                        coords.push({ x: center.x_, y: center.y_, n: 1} );
                    } else {
                        // Random, local, somewhat-circular arrangement
                        var shake = Math.random() - 0.5;
                        yoff = Math.sin(cs.n * Math.PI / 4)
                                * Math.log(cs.n + 10) / 3 + shake;
                        xoff = Math.cos(cs.n * Math.PI / 4)
                                * Math.log(cs.n + 10) / 3 + shake;
                        cs.n++;
                    }
                    return [ xoff + center.x_
                           , yoff + center.y_ ];
                };
                return f;
            }()
            ;

            //
            // Only draw universities with a location
            //
            var unis_valid = unis.filter(function(d, i, a) {
                if (d.nocoords === true) {
                    return false;
                };
                return true;
            });

            var unisNodes = g.selectAll('g.uni').data(unis_valid);

            var uniEnter = unisNodes.enter().append('g:g')
                .attr('class', 'uni')

                .attr('transform', function(d) {
                    var xy = projection([d.latitude, d.longitude]);
                    d.x = xy[0];
                    d.y = xy[1];
                    return 'translate(' + d.x + ',' + d.y + ')'; })

                //
                // Highlight doctors
                //
                .on('click', function(d) {
                    toggle_university(d, d3.select(this));
                })

                //
                // Display name
                //
                .on('mouseenter', function(d) {
                      $('#university-hover').html(d.name);
                })
                ;


            function toggle_university(d, elem) {
                    $('#university-hover').html(d.name);
                    if (d.doctors_institutions) {
                        var lines = elem.select('line');
                    d.doctors_institutions.forEach(function(doc) {
                        doctor = doc_find_by_url(doc.url);
                        if (doc !== null && lines.empty()) {
                            elem.append('line')
                                .attr('x1', '0')
                                .attr('y1', '0')
                                .attr('x2', '' + (doctor.x_ - d.x))
                                .attr('y2', '' + (doctor.y_ - d.y))
                                .attr('stroke-width', link_width / 5)
                                .attr('stroke', 'blue');
                        } else {
                            elem.select('line').remove();
                        };
                    });
                    }
            };

            //
            // Draw circle to represent university.
            // Size depends on number of associated doctors.
            //
            uniEnter.append('circle')
                .attr('class', 'uni-location')
                .attr('r',  function(d) {
                        var insti = d.doctors_institutions ?
                            d.doctors_institutions.length : 0;
                        var alma = d.doctors_alma_mater ?
                            d.doctors_alma_mater.length : 0;
                        d.radius = 0.5 + Math.sqrt(alma + insti + 1) / 2;
                        return d.radius;
                    });
            uniEnter.append('title')
                .text(function(d) {
                    return d.name
                });



            //
            // Find the geometric center of a doctor node based on all related
            // institution nodes.
            //
            function find_university_centroid(doc) {
                var xy;

                unis_loc = unis.filter(function(uni) {
                    var unis_found = doc.institutions.filter(function(insti) {
                        if (!insti.name) { if (!insti[0]) {return false;}
                            else {
                                return insti[0] === uni.url && !uni.nocoords;}}
                        return uni.name === insti.name && !uni.nocoords;
                    });
                    return unis_found.length > 0;
                });
                doc.x_ = 0;
                doc.y_ = 0;

                doc.only_one = false;
                doc.unis_loc = unis_loc;

                if (unis_loc.length == 0) {
                    xy = next_point(doc_find_by_url(doc.parent_url));
                    doc.x_ = xy[0];
                    doc.y_ = xy[1];
                } else {
                    if (unis_loc.length == 1)
                        doc.only_one = true;

                    unis_loc.forEach(function(u) {
                        doc.x_ += u.latitude; doc.y_ += u.longitude;
                    });

                    doc.x_ /= unis_loc.length;
                    doc.y_ /= unis_loc.length;
                    xy = next_point(doc);
                    doc.x_ = xy[0];
                    doc.y_ = xy[1];
                    doc.lat_ = doc.x_;
                    doc.long_ = doc.y_;
                    xy = projection([doc.x_, doc.y_]);
                    doc.x_ = xy[0];
                    doc.y_ = xy[1];
                }
                return doc;
            };


            //
            // Process each node, find centroid and set .selected=false
            //
            function traverse_list_tree(root, f) {
                f(root);
                if (root.children === undefined || root.children.length == 0)
                    { return root; }
                root.children.forEach(function (child) {
                    traverse_list_tree(child, f); });
            };

            traverse_list_tree(docs_root, function (d) {
                d.selected = false;
                find_university_centroid(d);
            });

            //
            // Most 'popular' node shall be highlighted on startup.
            //
            var max_children = { children: [] };
            traverse_list_tree(docs_root, function(d) {
                if (d.children === undefined) return;
                if (d.children.length > max_children.children.length) {
                    max_children = d;
                }
            })
            ;
            max_children.selected = true;
            max_children.children[0].selected = true;
            max_children.selected = true;
            max_children.children[0].selected = true;

            $('#university-select').html(max_children.name);

            //
            // Place nodes. Enable clicking/hovering behavior.
            //
            var docs = g.selectAll('g.doc').data(docs_list);
            var docEnter = docs.enter().append('g')

                .attr('class', function (d) {
                    return d.selected ? 'doc doc-selected' : 'doc'; })

                .attr('transform', function (d) {
                    return 'translate(' + d.x_ + ',' + d.y_ + ')'; })

                .on('click', function(d) {
                    toggle(d, d3.select(this)); })

                .on('mouseenter', function(d) {
                    $('#university-hover').html(
                        d.name + (d.redlink ? ' (redlink)':''))})

            //
            // Select/unselect a node. Update corresponding document elements.
            //
            function toggle(d, elem) {
                $('#university-select').html(d.name);
                d.selected = !d.selected;
                if (d.selected) {
                    elem.attr('class', 'doc doc-selected');
                    selected_docs.push([d,elem]);
                } else {
                    elem.attr('class', 'doc');
                }
            };

            //
            // Draw links to children and universities.
            //
            if (drawlinks) {
            docEnter.each(function (d) {
                var d_elem = d3.select(this);

                !d.hasOwnProperty('children') ? 0:
                d.children.forEach(function (child) {
                    var x_ = child.x_ - d.x_;
                    var y_ = child.y_ - d.y_;
                    var dist = Math.sqrt(Math.pow(x_, 2)
                                       + Math.pow(y_, 2));
                    var c = 5;
                    dist = dist <= 5 ? 5/c : dist/c;
                    var angle = Math.PI/2 + Math.atan2(y_, x_);
                    var dx = dist * Math.cos(angle);
                    var dy = dist * Math.sin(angle);

                    d_elem.append('path')
                        .attr('class', 'doctor-link')
                        .attr('stroke-width', link_width)
                        .attr('marker-end', 'url(#markerArrow)')
                        //
                   // http://www.w3.org/TR/SVG11/paths.html#PathDataMovetoCommands
                        .attr('d', 'm 0,0 c '  +
                                    + dx +','+ dy
                                    + ' '
                                    + (x_ + dx) +','+ (y_ + dy)
                                    + ' '
                                    + x_ +','+ y_
                                )
                        .attr('fill', 'none')
                        ;
                });

                d.unis_loc.forEach(function (uni) {

                d_elem.append('line')
                .attr('class', 'uni-link')
                .attr('stroke-width', link_width)
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', function(d) { return uni.x - d.x_; })
                .attr('y2', function(d) { return uni.y - d.y_; })
                ;
                })
                ;
            })
                ;
            }; // NOLINKS

            docEnter.append('circle')
                .attr('class', 'doc-centroid')
                .attr('r', doc_radius);
        });


        g.selectAll('path')
            .data(topojson.object(topology, topology.objects.countries)
                    .geometries)
            .enter()
            .append('path')
            .attr('class', 'topo')
            .attr('d', path);


    });

    //
    // Zoom, also scale lines and nodes.
    //
    var zoom = d3.behavior.zoom()
        .on('zoom', function() {
            var zoom_scale = d3.event.scale;
            g.attr('transform', 'translate(' +
                d3.event.translate.join(',') + ')scale(' + zoom_scale + ')');

            g.selectAll('g.uni')
             .selectAll('circle')
             .attr('r', function(d) {
                return 1 / Math.sqrt(zoom_scale) * d.radius;
             });

            d3.selectAll('line')
                .attr('stroke-width', function(d) {
                    return 1 / Math.sqrt(zoom_scale) * link_width / 3;
                });

            d3.selectAll('circle.search_highlight')
                .attr('r', function(d) {
                    return 1 / Math.sqrt(zoom_scale) * 8; })
                .attr('stroke-width', function(d) {
                    return 1 / Math.sqrt(zoom_scale) * link_width * 3;
                });

            var doc = g.selectAll('g.doc')
            doc.selectAll('circle')
                .attr('r', function(d) {
                    return 1 / Math.sqrt(zoom_scale) * doc_radius;
                });

            doc.selectAll('.doctor-link')
                .attr('stroke-width', function(d) {
                    return 1 / Math.sqrt(zoom_scale) * doc_radius;
                });
        });

    svg.call(zoom);


    return svg;
};






//
// Setup visualization settings UI and render with default configuration.
//

function make_selectors(container, key, description, traverse_keys) {
    var inp = $(container);
    inp = $("select", inp)
    inp.attr('onclick', 'render_with({' + key + ':this.value});');

    var drop = $('<option>', inp)
        .html(description).attr('value', '');
    inp.append(drop);

    traverse_keys(function (k) {
        inp.append($('<option>', inp)
        .attr('value', k).html(k));
    });
}


//
// Make dropdown lists!
//

make_selectors('#select-projection', 'projection', 'select a map projection',
    function (onEach) {
        for (var k in projections) {
            onEach(k);
    };
});

make_selectors('#select-data', 'data', 'select a JSON file', function (onEach) {
    json_files.forEach(onEach); }
);

function render_with(conf) {
    //
    // Handle incomplete configuration
    //
    if (conf.data === "" || conf.projection === "")
        return;
    if (conf.projection === undefined)
        conf.projection = glob_conf.projection;
    if (conf.data === undefined)
        conf.data = glob_conf.data;
    if (projections[conf.projection] === undefined)
        return;
    if (visualization_svg !== undefined)
        visualization_svg.remove();
    //
    // reset search bar and render SVG
    //
    $("#scrollable-dropdown-menu").empty().append(
        '<input class="typeahead" type="text" '
    +   ' placeholder="Type to find a doctor or institution">');

    console.log(conf);
    glob_conf = conf;
    visualization_svg = render(projections[conf.projection], conf.data);
};

render_with(glob_conf);




