config = {}
config.nodes = 25;
config.links = 100;
config.draw_nodes = true;
config.draw_force = true;
config.radius_by_what = "by_deg_rel",
config.axis_by_what = "by_deg_thirds";




// read query string, from Stackoverflow somewhere...
var queryString = {};
location.search.substr(1)
    .split("&").forEach(function(item)
            {queryString[item.split("=")[0]] = item.split("=")[1]});

["nodes", "links"].forEach(function(x) {
    if (queryString[x] !== undefined) config[x] = +queryString[x];
});
["draw_nodes", "draw_force"].forEach(function(x) {
    if (queryString[x] !== undefined) config[x] = !config[x];
});


var width = height = 440,
    hive_plot = mk_hive_plot()
    .innerRadius(20)
    .outerRadius(width / 2 - 40)
    .node_height(6)
    .node_width (9)
    .opacity(0.5)





    var angle, radius, color,
        deg_minmax, nn_minmax, cc_minmax;


var axis_text,
    axis_assign,
    radius_assign;

function draw_hp_force(nodes, links) {
    var result = {svg:{}};

    // 0,1,2 -> 3 angles
    angle = d3.scale.ordinal().domain(d3.range(0,3)).rangePoints([0, 4/3 * Math.PI]);
    var rng = angle.range();
    if (config.axis_by_what.endsWith("directed")) {
        rng[2] = [rng[2], rng[2] - Math.PI / 6];
        rng[0] = [rng[0]];
        rng[1] = [rng[1]];
    }
    else {
        rng = rng.map(function(a) {return [a, a-Math.PI/6]})
    }
    console.log(angle.range(), rng);
    angle.range(rng);

    // 0..1 -> radius
    radius = d3.scale.linear().range([hive_plot.innerRadius(), hive_plot.outerRadius()]);
    // 0,1,2 -> 3 colors
    color = d3.scale.ordinal().domain(d3.range(3)).range(colorbrewer.Dark2[4]);


    // prepare SVG document
    var svg = d3.select("div#vis").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "vis");
    var hive_g = svg.append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    // create graph
    var nodes = (nodes !== undefined) ? nodes : random_nodes(config.nodes, config.nodes);
    var links = (links !== undefined) ? links : random_links(nodes, config.links, config.links, randint);

    // TODO more node classification functions
    // cc, nn, ccnn, degree, user-defined
    deg_minmax = find_degree(nodes, links, true);
    nn_minmax  = find_next_neighbors(nodes, links);
    cc_minmax  = find_cc(nodes, links);
    nodes[deg_minmax.max].max_by_deg = true;
    nodes[nn_minmax .max].max_by_nn = true;
    //nodes[cc_minmax .max] .max_by_cc = true;


    var as = mk_assigners(nn_minmax, deg_minmax, cc_minmax, radius, angle);
        axis_text = as.axis_text,
        axis_assign = as.axis_assign,
        radius_assign = as.radius_assign;







    hive_plot
        .svg(hive_g)
        .angle(angle)
        .radius(radius)
        .color(color)
        .nodes(nodes)
        .draw_nodes(config.draw_nodes)
        .toggle_select_node(toggle_select_node)
        .toggle_select_link(toggle_select_link)
        .links(links)
        .elem_angle(axis_assign[config.axis_by_what])
        .elem_radius(radius_assign[config.radius_by_what])
        .elem_color(
            function(d, i, islink) {
                if (islink) d = nodes[d.source];
                return !islink ? color(d.a) : d['max_' + config.axis_by_what] ? color(d.a) : "#aaa";
        });
    // DRAW IT
    var g = hive_plot();


    // EXAMPLE svg grid
    g.selectAll("circle.grid")
        .data(radius.ticks(10))
      .enter().append("g")
        .attr("class", "grid")
        .append("circle")
        .attr("r", function (d) { return radius(d); });

    g.selectAll("text.axis_title")
        .data(angle.range())
      .enter().append("text")
        .attr("class", "axis_title")
        .attr("x", function (d) { return hive_plot.outerRadius() * Math.cos(d3.mean(d)); })
        .attr("y", function (d) { return hive_plot.outerRadius() * Math.sin(d3.mean(d)); })
        .attr("text-anchor", "middle")
        .style("font-weight", "bold")
        .text( axis_text[config.axis_by_what] );







    //TODO  use quick node size animation to double highlight
    function toggle_select_node(d, i) {
        if (d._selected = !d._selected) {
            console.log(d);
            d3.selectAll(".node_" + i).style("stroke", "black").style("stroke-width", 6);
        }
        else
            d3.selectAll(".node_" + i).style("stroke", "none");
    }

    function toggle_select_link(d, i) {
        if (d._selected = !d._selected) {
            console.log(d, nodes[d.source], nodes[d.target]);
            d3.selectAll(".link_" + i).style("stroke-width", 7);
        }
        else
            d3.selectAll(".link_" + i).style("stroke-width", 2);
    }







    result.svg.legend = draw_color_legend("node.a", function(d) {return d;}, color);

    if (config.draw_force)
        result.svg.force = draw_force_directed($.extend(true, [], nodes), $.extend(true, [], links));
    result.svg.hive_plot = svg;
    result.nodes = nodes;
    result.links = links;







    return result;
}

/**************************** FORCE DIRECTED LAYOUT **************************/
///// by mike bostock: http://bl.ocks.org/mbostock/1153292
function draw_force_directed(nodes, links) {
    //
    //
    //
    // this layout modifies the links array, give it a deep copy
    //
    var links_force = $.extend(true, [], links),
        force_width = width * 0.75,
        force_height = height;

    var force = d3.layout.force()
        .nodes(d3.values(nodes))
        .links(links_force)
        .size([force_width, force_height])
        .linkDistance(60)
        .charge(-300)
        .on("tick", tick)
        .start();

    var svg_force = d3.select("div#vis").append("svg")
        .attr("width", force_width)
        .attr("height", force_height)
        .attr("class", "vis_force")

    // Per-type markers, as they don't inherit styles.
    svg_force.append("defs").selectAll("marker")
        .data(color.range().concat(["#444"]))
      .enter().append("marker")
        .attr("id", function(d) { return d; })
        .attr("refX", "7")
        .attr("refY", "3")
        .attr("viewBox", "0 0 6 6")
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .attr("fill", function (d) { return d; })
      .append("path")
        .attr("d", "M 0,0 L 6,3 L 0,6 z ");

    var path = svg_force.append("g").selectAll("path.link")
        .data(force.links())
      .enter().append("path")
        .attr("class", function (d,i) { return "link force_link link_" + i; })
        .style("stroke", function(d) { return !d.source.max_deg ? "#444" :
                (color(d.source.a));
        })
        .attr("marker-end", function (d) { return "url(#"
            + (d.source.max_deg ? "#444" :
                    color(d.source.a)) + ")"; })
        .on("click", toggle_select_link);

    var circle = svg_force.append("g").selectAll("circle.node")
        .data(force.nodes())
      .enter().append("circle")
        .attr("class", function (d,i) { return "node node_" + i; })
        .attr("r", function (d) { return Math.sqrt(100 * d.b) + 1; })
        .attr("fill", function (d) { return color(d.a); })
        .call(force.drag)
        .on("click", toggle_select_node);

    svg_force.append("text")
        .attr("fill", "black")
        .attr("y", height / 12)
        .attr("x", force_width / 2)
        .attr("font-size", "0.8em")
        .attr("font-style", "italic")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .text("node.b ↔ node area");

    // Use elliptical arc path segments to doubly-encode directionality.
    function tick() {
      path.attr("d", linkArc);
      circle.attr("transform", transform);
    }

    function linkArc(d) {
      var dx = d.target.x - d.source.x,
          dy = d.target.y - d.source.y,
          dr = Math.sqrt(dx * dx + dy * dy);
      return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
    }

    function transform(d) {
      return "translate(" + d.x + "," + d.y + ")";
    }



    //TODO  use quick node size animation to double highlight
    function toggle_select_node(d, i) {
        if (d._selected = !d._selected) {
            d3.selectAll(".node_" + i).style("stroke", "black").style("stroke-width", 6);
        }
        else
            d3.selectAll(".node_" + i).style("stroke", "none");
    }

    function toggle_select_link(d, i) {
        if (d._selected = !d._selected) {
            console.log(d, nodes[d.source], nodes[d.target]);
            d3.selectAll(".link_" + i).style("stroke-width", 7);
        }
        else
            d3.selectAll(".link_" + i).style("stroke-width", 2);
    }






    return svg_force;
}












