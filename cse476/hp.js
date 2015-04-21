/*
   TODO use lasso to select many nodes

   TODO nice labels + overlapping links
   http://geotheory.co.uk/blog/wp-content/uploads/2013/10/Spad_Hospitality.png

   TODO rewrite D3 flare imports example using the new group API

   TODO demonstrate links between bar plots and filled HPs

   TODO tour guide
   http://clu3.github.io/bootstro.js/ BOOTSTRO!!!!
   highlight node axis with big letter on a white circle, stroke=black
   demonstrate node/axis/group highlighting

   TODO have a legend for colors, node positions

   TODO normalized and absolute node position (special for hive panels)
    axis size <====> extreme node positions

   TODO use D3 transitions for network comparisons
   TODO use svg to make nice hive panels
   TODO axis groups
*/


/**************************** HIVE PLOT: AXES, NODES, LINKS ******************/
function mk_hive_plot() {
    var svg, angle, radius, nodes, links, draw_nodes=true,
        toggle_select_node, toggle_select_link,
        innerRadius, outerRadius, node_width=6, node_height=2,
        elem_radius, elem_angle, elem_color, opacity;

    var vis = function() {
        if (opacity === undefined)
            opacity = 0.05 + Math.log(10)/Math.log(links.length);

        // TODO allow reversing of axis or group segments
        var g = svg
            ;

        g.selectAll("g.axis")
            .data(angle.range())
          .enter().append("g")
            .attr("class", function (d,i) { return "axes" + i; })
            .selectAll("line")
            .data(function(d) { return d; })
          .enter()
            .append("line")
            .attr("class", function (d,i) { return "axis axis" + i; })
            .attr("transform", function(d) { return "rotate(" + degrees(d) + ")"; })
            .attr("stroke", "black")
            .attr("x1", innerRadius)
            .attr("x2", outerRadius);


        var link = d3.hive.link()
               .source(function (d) { return nodes[d.source]; })
               .target(function (d) { return nodes[d.target]; })
               .angle(function(d, i, link) {
                   var is_source = nodes[link.source] === d;
                       a = elem_angle(d),
                       b = elem_angle( is_source ? nodes[link.target]
                                                 : nodes[link.source]);
                   if (a === b)
                       return is_source ? a[1] : a[0];
                   return nearest_angle(a,b);
               })
               .radius(function(d) { return elem_radius(d); });

        g.selectAll("path.link")
            .data(links)
          .enter().append("path")
            .attr("class", function(d, i) { return "link link_" + i;})
            .style("stroke", function(d, i) {return elem_color(d, i, true)})
            .style("stroke-opacity", opacity)
            ///////////TODO
            .on("click", toggle_select_link)
            .attr("d", link)
        ;




        // TODO option: node size encoding (ala jhive)
        // TODO nodes currently take discrete positions
        // make connections somehow spread out evenly across the axis?
        if (draw_nodes)
        g.selectAll("g.node")
            .data(nodes)
          .enter()
            .append("g")
            .attr("class", "node_g")
            .each(function(d, i) {
                var elem = d3.select(this);
                elem_angle(d).forEach(function (angle) {
                    var a = angle - Math.atan(node_width/2 / elem_radius(d));
                    var x = (elem_radius(d)) * Math.cos(a),
                        y = (elem_radius(d)) * Math.sin(a);


                    elem
            .append("rect")
            .attr("class", "node node_" + i)
            .attr("x",x)
            .attr("y",y)
            .attr("transform", "rotate(" + degrees(angle) + " " + x + " " + y + ")" )
            //.attr("transform", "rotate(" + degrees(angle) + ")" )
            //.attr("x", elem_radius(d) - node_height/2)
            //.attr("y", -node_width/2)
            .attr("height", node_width)
            .attr("width", node_height)
            .style("fill", elem_color(d) )
            }) })
            ///////////TODO
            .on("click", toggle_select_node);





        function min_with(f, xs) {
            var min = xs[0];
            xs.forEach(function(x) {
                if (f(x) < f(min)) min = x;
            });
            return min; }

        function snd(x){ return x[1]; }

        ////////////FIXME TODO
        // overkill for 6 axes...
        // should have more structured angle.range().
        function nearest_angle(angles_a, angles_b) {
            /* i know this looks bad... but angle.range() is supposed to be a small array */
            // find the pair of angles with minimal separation
            return min_with(snd, angles_a.map(function (a) {
            return min_with(snd, angles_b.map(function (b) {
                    return [a, Math.abs(a - b)%(Math.PI/2)];
            })); }))[0];
        }

        return g;
    }

    vis.opacity = function(_) { if (!arguments.length) return opacity ;
                            opacity = _; return vis; }
    vis.svg = function(_) { if (!arguments.length) return svg;
                            svg = _; return vis; }
    vis.nodes = function(_) { if (!arguments.length) return nodes ;
                            nodes = _; return vis; }
    vis.links = function(_) { if (!arguments.length) return links ;
                            links = _; return vis; }
    vis.draw_nodes = function(_) { if (!arguments.length) return draw_nodes ;
                            draw_nodes = _; return vis; }
    vis.toggle_select_node = function(_) { if (!arguments.length) return toggle_select_node ;
                            toggle_select_node = _; return vis; }
    vis.toggle_select_link = function(_) { if (!arguments.length) return toggle_select_link ;
                            toggle_select_link = _; return vis; }
    vis.innerRadius = function(_) { if (!arguments.length) return innerRadius ;
                            innerRadius = _; return vis; }
    vis.outerRadius = function(_) { if (!arguments.length) return outerRadius ;
                            outerRadius = _; return vis; }
    vis.node_width = function(_) { if (!arguments.length) return node_width ;
                            node_width = _; return vis; }
    vis.node_height = function(_) { if (!arguments.length) return node_height ;
                            node_height = _; return vis; }
    vis.elem_radius = function(_) { if (!arguments.length) return elem_radius ;
                            elem_radius = _; return vis; }
    vis.elem_angle = function(_) { if (!arguments.length) return elem_angle ;
                            elem_angle = _; return vis; }
    vis.elem_color = function(_) { if (!arguments.length) return elem_color ;
                            elem_color = _; return vis; }
    vis.radius = function(_) { if (!arguments.length) return radius ;
                            radius = _; return vis; }
    vis.angle = function(_) { if (!arguments.length) return angle ;
                            angle = _; return vis; }
    vis.color = function(_) { if (!arguments.length) return color ;
                            color = _; return vis; }
    return vis;
}


/*************************** color legend ************************************/
function draw_color_legend(title, get_name, color, where) {
    if (where === undefined)
        where = d3.select("div#vis");

    var legend = where.append("svg")
        .attr("class", "legends")
        .attr("width", 36 * Math.max(color.domain().length))
        .attr("height", 100);

    var g = legend.append("g")
            .attr("transform", "translate(5,20)"); // margins

    g.append("text")
        .attr("class", "legend-title")
        .text(title);

    legend_elems = g.selectAll("g.legend-elem")
        .data(color.domain())
      .enter().append("g")
        .attr("class", "legend-elem")
        .attr("transform", function(d, i)
            { return "translate(" + (i * 32) +",15)"; })
        ;

    legend_elems.append("text")
        .text(get_name);

    legend_elems.append("rect")
        .attr("fill", function(d) { return color(d); })
        .attr("y", 3)
        .attr("width", 15)
        .attr("height", 15);

    return legend;
}











/************************* GRAPH GENERATION *********************************/

function random_nodes(min, max) {
    if (arguments.length !== 2) {
        min = 5;
        max = 10;
    }
    var nodes = d3.range(randint(min, max));
    nodes = nodes.map(function () {
        d = {
        a: randint(0,3),
        b: randint(5, 100) / 100};
        return d;
    });
    return nodes;
}

function random_links(nodes, min, max, rand_node_picker) {
    // only one argument? then E = 2V
    if (!arguments.length === 1) {
        min = nodes.length;
        max = min;
        rand_node_picker = randint;
    }
    var links = d3.range(randint(min, max));
    links = links.map(function() {
        d = {
        source: rand_node_picker(0, nodes.length),
        target: rand_node_picker(0, nodes.length),
        }
        return d;
    });
    if (!arguments.length === 1)
        nodes.forEach(function (node, node_ix) {
            var sink = Math.random() > 0.5;
            links.push({
            source: sink ? node_ix : randint(0, nodes.length),
            target: sink ? randint(0, nodes.length) : node_ix,
            });
        });
    return links;
}

function randint(min, max) { return min === max ?
    max : min + Math.floor(Math.random() * (max - min)); }

function mk_randint_normal(min, max) {
    var dist = d3.random.normal((min + max) / 2,
            Math.sqrt((max - min) * (max - min) / 12));
    return function() {
        return min === max ?
        max : clamp(min, max, Math.floor(dist()));
    }
}

function clamp(min, max, x) { return x < min ? min : x > max ? max : x; }







/******** graph utlities *************/
function findByName(l, n) {
    for (var i = 0; i < l.length; i++)
        if (l[i].name === n) return i;
    return -1;
}

function by_obj_to_ix(nodes, links) {
    links.forEach(function(l) {
        l.source = findByName(nodes, l.source);
        l.target = findByName(nodes, l.target);
    });
}

function find_degree(nodes, links) {
    nodes.forEach(function(n) { n.deg = 0, n.deg_in = 0, n.deg_out = 0; });
    links.forEach(function(l) {
        nodes[l.source].deg_out++;
        nodes[l.target].deg_in++;
    });
    var min_deg = 0, max_deg = 0;
    nodes.forEach(function(n, i) {
        n.deg = n.deg_in + n.deg_out;
        if (nodes[min_deg].deg > n.deg) min_deg = i;
        if (nodes[max_deg].deg < n.deg) max_deg = i;
    });
    return [min_deg, max_deg];
}




function degrees(radians) {
    return radians / Math.PI * 180;
}
