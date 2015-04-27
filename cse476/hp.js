function mk_assigners(nn_minmax, deg_minmax, cc_minmax, radius, angle) {
    var radius_assign = {
        by_deg_normalized: mk_normalized("deg", deg_minmax),
        by_nn_normalized: mk_normalized("nn"  , nn_minmax),
        by_deg: function(d, i) { return radius(d.deg / deg_minmax.max_val); },
        by_nn: function(d, i) { return radius(d.nn / nn_minmax.max_val); }
    },
    axis_assign = {
        by_deg: function(d, i)
        { return angle(d.deg > 2 ? 0 : d.deg < 2 ? 1 : 2) },
        by_deg_thirds: function(d, i)
        { return angle(deg_minmax.quantile(d.deg)); },
        by_deg_directed: function(d, i)
        { return angle(d.deg_in === 0 ? 2 : d.deg_out === 0 ? 1 : 0) },
        by_nn: function(d, i)
        { return angle(d.nn > 2 ? 0 : d.nn < 2 ? 1 : 2) },
        by_nn_thirds: function(d, i)
        { return angle(nn_minmax.quantile(d.nn)); },
        by_nn_directed: function(d, i)
        { return angle(d.nn_in === 0 ? 2 : d.nn_out === 0 ? 1 : 0) },
    },
    axis_text = {
        by_deg: function(d, i)
        { return i === 0 ? "deg > 2" : i === 1 ? "deg < 2" : "deg = 2"; },
        by_deg_directed: function(d, i)
        { return i === 2 ? "only out" : i == 1 ? "only in" : "in/out"; },
        by_deg_thirds: mk_thirds("deg", deg_minmax),
        by_nn: function(d, i)
        { return i === 0 ? "nn > 2" : i === 1 ? "nn < 2" : "nn = 2"; },
        by_nn_thirds: mk_thirds("nn", nn_minmax),
    };
    axis_text.by_nn_directed = axis_text.by_deg_directed;

    function mk_normalized (which, which_minmax) { return function(d, i) {
            var q = which_minmax.quantile(d[which]),
                x1 = Math.round(which_minmax.quantile.invert(q)),
                x2 = q == 2 ? which_minmax.max_val :
                     Math.round(which_minmax.quantile.invert(q + 1));
            return radius((d[which] - x1) / (x2 - x1));
        }
    }
    function mk_thirds(which, which_minmax) { return function (d, i) {
          var m = which_minmax.max_val,
              inv = function(x){ return Math.ceil(which_minmax.quantile.invert(x)) },
              end = i == 2 ? "]" : ")";
          return which + " ∈ [" + inv(i) + "," + (i == 2 ? m : inv(i+1)) + end;i
        }
    }

    return { radius_assign: radius_assign,
             axis_assign: axis_assign, axis_text: axis_text }
}


function get_cloned(n) {
    if (n.endsWith("directed")) return { cloned: [0], not: [1,2] }
    else return { cloned: [0,1,2], not: [] };
}

/**************************** HIVE PLOT: AXES, NODES, LINKS ******************/
function mk_hive_plot() {
    var svg, angle, radius, nodes, links, toggle_select_node, toggle_select_link,
        innerRadius, outerRadius, elem_radius, elem_angle, elem_color, opacity,
        node_width=6, node_height=2, draw_nodes=true, draw_links=true;

    var vis = function() {
        if (opacity === undefined)
            opacity = 0.05 + Math.log(10)/Math.log(links.length);

        var g = svg;

        // draw axis, possibly cloned
        g.selectAll("g.axis")
            .data(angle.range())
          .enter().append("g")
            .attr("class", function (d,i) { return "axes axes" + i; })
            .selectAll("line")
            .data(function(d) { return d; })
          .enter()
            .append("line")
            .attr("class", function (d,i) { return "axis axis" + i; })
            .attr("transform", function(d) { return "rotate(" + degrees(d) + ")"; })
            .attr("x1", innerRadius)
            .attr("x2", outerRadius);


        // create links
        var link = d3.hive.link()
               .source(function (d) { return nodes[d.source]; })
               .target(function (d) { return nodes[d.target]; })
               .radius(function(d) { return elem_radius(d); })
               .angle(function(d, i, link) {
                   var is_source = nodes[link.source] === d, r,
                       a = elem_angle(d),
                       b = elem_angle( is_source ? nodes[link.target]
                                                 : nodes[link.source]);
                   if (a === b)
                       return (is_source && a.length > 1) ? a[1] : a[0];
                   else
                       return nearest_angle(a,b);
               });

        // draw links
        if (draw_links) {
            var paths = g.selectAll("path.link")
                .data(links)
              .enter().append("path")
                .attr("class", function(d, i) { return "link link_" + i;})
                .style("stroke", function(d, i) {return elem_color(d, i, true)})
                .style("stroke-opacity", opacity)
                .attr("d", link);

            if (toggle_select_link)
                paths.on("click", toggle_select_link)
        }

        if (draw_nodes) {
            var node_elems = g.selectAll("g.node")
                .data(nodes)
              .enter()
                .append("g")
                .attr("class", "node_g")
                .each(function(d, i) {
                    d.d3_ix = i;
                    var elem = d3.select(this);
                    elem_angle(d).forEach(function (angle) {
                        var a = angle - Math.atan(node_width/2 / elem_radius(d));
                        var x = (elem_radius(d)) * Math.cos(a),
                            y = (elem_radius(d)) * Math.sin(a);
                elem
                .append("rect")
                .attr("class", "node node_" + i)
                .attr("x",x).attr("y",y)
                .attr("transform", "rotate(" + degrees(angle) + " " + x + " " + y + ")" )
                .attr("height", node_width).attr("width", node_height)
                .style("fill", elem_color(d) )
                }) })

            if (toggle_select_link)
                node_elems.on("click", toggle_select_node);
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
    vis.draw_links = function(_) { if (!arguments.length) return draw_links ;
                            draw_links = _; return vis; }
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


function min_with(f, xs) {
    var min = xs[0];
    xs.forEach(function(x) {
        if (f(x) < f(min)) min = x; });
    return min; }

// overkill for 6 axes...
// should have more structured angle.range().
function nearest_angle(angles_a, angles_b) {
    /* i know this looks bad... but angle.range() is supposed to be a small array */
    // find the pair of angles with minimal separation
    return min_with(function(x) { return x[1]; }, angles_a.map(function (a) {
    return min_with(function(x) { return x[1]; }, angles_b.map(function (b) {
            return [a, Math.abs(a - b)%(Math.PI/2)];
    })); }))[0]; // doing it with tuples, get the actual value, not the index
}
