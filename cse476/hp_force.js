config = {}
config.nodes = 20;
config.links = 40;
config.draw_nodes = true;
config.draw_force = true;

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


var width  = 770,
    height = 800,
    hive_plot = mk_hive_plot()
    .innerRadius(20)
    .outerRadius(340)
    .node_height(2)
    .node_width (6)
    .opacity(0.2)





    var angle, radius, color;

var radius_by_what = "by_b",
    axis_by_what = "by_a";
var radius_assign = {
    by_b: function(d) { return radius(d.b); }
};

var axis_assign = {
    by_deg: function(d, i)
    { return angle((d.deg === 1 || d.deg === 0) ? 2 :
            d.deg === 2 ?  1 : 0) },
    by_a: function(d, i)
    { return angle(d.a); }
};

var axis_text = {
    by_deg: function(d, i)
    { return i === 1 ? "deg = 2" : i == 2 ? "deg < 2" : "deg > 2"; },
    by_a : function(d, i)
    { return "a=" + i; }
};
function draw_hp_force(nodes, links) {
    var result = {svg:{}};

    angle = d3.scale.ordinal().domain(d3.range(0,3)).rangePoints([0, 4/3 * Math.PI]);
    radius = d3.scale.linear().range([hive_plot.innerRadius(), hive_plot.outerRadius()]);
    color = d3.scale.ordinal().domain(d3.range(3)).range(colorbrewer.Dark2[4]);

    //clone axes
    angle.range(angle.range().map(function (angle, ix)
                { return [angle, angle + Math.PI / 6] }));


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
    var minmax = find_degree(nodes, links);
    nodes[minmax[1]].max_deg = true;

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
        .elem_angle(axis_assign[axis_by_what])
        .elem_radius(radius_assign[radius_by_what])
        .elem_color(
            function(d, i, islink) {
                if (islink) d = nodes[d.source];
                return !islink ? color(d.a) : d.max_deg ? color(d.a) : "#444";
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
        .text( axis_text[axis_by_what] );







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
function draw_force_directed(nodes, links) {
    //
    //
    //
    // this layout modifies the links array, give it a deep copy
    //
    var links_force = $.extend(true, [], links);

    var force = d3.layout.force()
        .nodes(d3.values(nodes))
        .links(links_force)
        .size([width/2, height/2])
        .linkDistance(60)
        .charge(-300)
        .on("tick", tick)
        .start();

    var svg_force = d3.select("div#vis_force").append("svg")
        .attr("width", width/2)
        .attr("height", height/2)
        .attr("class", "vis_force")

    // Per-type markers, as they don't inherit styles.
    svg_force.append("defs").selectAll("marker")
        .data(color.range().concat(["#444"]))
      .enter().append("marker")
        .attr("id", function(d) { return d; })
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", -1.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .attr("fill", function (d) { return d; })
      .append("path")
        .attr("d", "M0,-5L10,0L0,5");

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
        .attr("x", width / 12)
        .attr("font-size", "0.8em")
        .attr("font-style", "italic")
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






    return svg_force;
}












