//// need String.startsWith
if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) === 0;
  };
}


// data manager
var data_man = mk_data_man();

// globals for scaling and the focused node
var min = 0.0000001,
    extrema = { min: extreme_keeper(), max: extreme_keeper() };

var flow_scale;

// COLOR AND DATA RANGE
var compact_frm = d3.format('.1s');
function compact_money(n) { return compact_frm(n * 1E6) + ' USD'};

var frm = d3.format(',.2f')
function money(n) { return frm(n) + ' million USD'; }

// color management
var categories = 5,
    color = {
    natural: d3.scale.ordinal().domain(d3.range(categories + 1))
        .range(colorbrewer.RdPu[categories + 1]),
    integer: d3.scale.ordinal().domain(d3.range(categories + 1))
        .range(colorbrewer.RdYlGn[categories + 1])
    };






/********************************************************** */

function selected_elements(elems) {
    var ws = d3.select('#elements_info');
    var ws_data = ws.selectAll('.element_info')
        // don't identify data using its list index
        .data(elems, function(d) { return d.ccode; });

    ws_data.exit()
        .style('color', 'white')
        .transition()
        .duration(800)
        .style('height', '12px')
        .remove();

    var ws_new = ws_data.enter()
        .insert('div', ':first-child')
        .attr('class', 'element_info')
        .style('background', 'black');

   ws_new.transition()
   .duration(800)
   .style('background', 'white');

   ws_new.append('h3')
   .text(function (d) { return d.name + ' - ' + d.year; });

   var flows = [],
       dic = extrema.max.flow_types();
   for (var k in dic)
       flows.push([k, dic[k]]);
   ws_new.each(function (d) {
       ws_new.selectAll('p')
       .data(flows)
       .enter().append('p')
       .text(function (ft) { return ft[0] + ': ' +
           ft[1](d.flow1_total, d.flow2_total); })
   });

    return ws_data;
}











function draw_palette(g, height, width) {
    // color palette
    var rsize = 80;
    var palette_elems = g.selectAll('.palette-element')
        .data(color[extrema.max.color_type()].range()).enter()
        .append('g')
        .attr('transform', function(d, i) { return 'translate(' +
            (200 + i * (rsize + 5)) + ',' + (height - 4 * rsize) + ')'; })
        .attr('class', 'palette-element')

    palette_elems
        .append('rect')
        .style('fill', function (d) { return d; })
        .attr('width', rsize).attr('height', rsize / 5);

    palette_elems
        .append('text')
        .attr('y', -10)
        .attr('x', rsize/2)
        .text(function(d, i) {
            // min is lowest, not 0
            return compact_money(flow_scale.invert(i === 0 ? min : i));
        });
}




// scale a trade volume to an integer between 0 and categories
function mk_scale() {
    return
        ;
}

function get_highlight_fill(d, i){
    return color[extrema.max.color_type()](flow_scale(
                extrema.min.node_flow(d)));
}
function get_neutral_fill(d, i){
    if (!d.valid) return 'url(#diagonal_hatch)';
    return color[extrema.max.color_type()](flow_scale(
                extrema.min.node_flow(d, '_total')));
}


function extrema_reflow() {
    if (extrema.max() < extrema.min()) {
        var tmp = extrema.min;
        extrema.min = extrema.max;
        extrema.max = tmp;
    }
    flow_scale =
        d3.scale.linear()
        .domain(d3.range(extrema.min(), extrema.max(),
                Math.abs(extrema.max() - extrema.min()) / (categories + 1)
                ))
        .range(d3.range(categories + 1))
        .clamp(true)
        ;
}



function basic_stats() {
    return { 'flow1': min, 'flow2': min };
}

function extreme_keeper () {
    var flows = {},
        current_flow = 'diff12rel',
        global_min = basic_stats(),
        year = '1950'
        flow_types = {
        'flow1' : function(f1, f2) {return f1;},
        'flow2' : function(f1, f2) {return f2;},
        'diff21' : function(f1, f2) {return f2 - f1;},
        'diff12' : function(f1, f2) {return f1 - f2;},
        'diff21rel' : function(f1, f2) {return (f2 - f1)/(f1 + f2);},
        'diff12rel' : function(f1, f2) {return (f1 - f2)/(f1 + f2);},
        };
    flows[year] = basic_stats();

    var stat = function () {
            return flow_types[current_flow](flows[year]['flow1'], flows[year]['flow2']);
        }

    stat.flow1 = function(_) {
        if (!arguments.length) return flows[year].flow1;
            flows[year].flow1 = _;
        return stat;
    }

    stat.flow2 = function(_) {
        if (!arguments.length) return flows[year].flow2;
        flows[year].flow2 = _;
        return stat;
    }

    stat.year = function(_) {
        if (!arguments.length) return year;
        year = _;
        if (!flows.hasOwnProperty(year))
            flows[year] = basic_stats();
        return stat;
    }

    stat.current_flow = function(_) {
        if (!arguments.length) return current_flow;
        current_flow = _;
        return stat;
    }

    stat.flow_types = function() { return flow_types; }

    stat.node_flow = function(d, suffix) {
        d = d.trade_info;
        if (suffix === undefined) suffix = '';
        return flow_types[current_flow](d['flow1'  + suffix], d['flow2' + suffix]);
    }

    stat.color_type = function () {
        if (current_flow.startsWith('diff'))
            return 'integer';
        return 'natural'
    }

    return stat;
}





/********************************************************** YEAR SWITCHER */

/********************************************************** GEO VIS */
function geo_vis(root, topology, dm, width, height) {
    var path, svg, g, projection,
        data_man = dm,
        topology = topology,
        year = '1870';
    ////wtf....
        width = width ? width : 800,
        height = height ? height : 500,
        focus_code = undefined,
        zoom = d3.behavior.zoom()
            .scaleExtent([1, 10])
            .on("zoom", move);

        projection = d3.geo.conicEqualArea()
            .translate([width / 2, height * 0.7]);

        path = d3.geo.path()
            .projection(projection);

    var draw;
    geo = function() {
        if (svg !== undefined) svg.remove();
        data_man.call_with_data(year, draw);
        return geo;
    }

    geo.g = function() { return g; }
    geo.svg = function() { return svg; }
    geo.year = function (_) {
        if (!arguments.length) return year;
        year = _;
        return geo;
    }

    // change scale, recolor
    geo.current_flow = function(current_flow) {
        extrema.max.year(year);
        extrema.min.year(year);

        extrema.min.current_flow(current_flow);
        extrema.max.current_flow(current_flow);
        extrema_reflow();
        g.selectAll('.feature')
            .style('fill', focus_code ? get_highlight_fill
                                      : get_neutral_fill);
        return geo;
    }

    draw = function(trade_data, by_ccode) {
        extrema.max.year(year);
        extrema.min.year(year);

        svg = root.append('svg')
            .attr('width', width)
            .attr('height', height)
            .call(zoom);

        // make a diagonal hatch pattern
        // from: carto.net/svg/samples/pattern0.svg
        svg.append('defs')
          .append('pattern')
            .attr('id', 'diagonal_hatch').attr('patternUnits', 'userSpaceOnUse')
            .attr('height', '105').attr('width', '105').attr('x', 0).attr('y', 0)
          .append('g')
            .style('fill', 'white')
            .style('stroke', 'lightgrey')
            .style('stroke-width', 2)
            .selectAll('path').data(['M0 90 l15,15', 'M0 75 l30,30', 'M0 60 l45,45',
            'M0 45 l60,60', 'M0 30 l75,75', 'M0 15 l90,90', 'M0 0 l105,105', 'M15 0 l90,90',
            'M30 0 l75,75', 'M45 0 l60,60', 'M60 0 l45,45', 'M75 0 l30,30', 'M90 0 l15,15' ])
            .enter()
          .append('path')
            .attr('d', function(d) { return d; });


        g = svg.append('g');

        g.append('rect')
            .attr('class', 'background')
            .attr('width', width)
            .attr('height', height);


        get_hover_fill = 'black';


        // draw map
        g.selectAll('.feature')
        .data(topojson.feature(topology, topology.objects).features)
        .enter()
        .append('g')
        .attr('class', 'country')
        .append('path')
        .attr('d', path)
        .attr('class', function(d) { return 'feature ccode_' + d.properties.COWCODE; })
        .on('mouseover', function(d) {
            d3.select(this)
                .style('fill', get_hover_fill)
        })
        .on('mouseout', function(d) {
            if (focus_code === d.properties.COWCODE) return;
            d3.select(this)
                .style('fill', focus_code ? get_highlight_fill :
                                            get_neutral_fill);
        })
        .append('svg:title')
        .text(function (d) {
            return d.properties.ISONAME + ', capital: ' + d.properties.CAPNAME;
        });

        // match each trade record with corresponding country element
        g.selectAll('g.country')
        .each(function(d) {
            var node_ix = by_ccode.indexOf(d.properties.COWCODE);
            if (node_ix < 0) {
                // not found in trade data nodes
                d.valid = false;
                d3.select(this)
                    .style('fill', get_neutral_fill);
                return;
            }
            d.valid = true;
            d.trade_info = trade_data.nodes[node_ix];
            d.trade_info_on = false;
            d3.select(this)
                .style('fill', get_neutral_fill)
                .on('click', toggle_trade_info);
        });


        function toggle_trade_info(d) {
            d3.select(this).each(function (_) {
                if (focus_code === d.properties.COWCODE) {
                    // clear effects of highlighting
                    focus_code = undefined;
                    d3.selectAll('.feature')
                        .style('display', 'inline')
                        .style('fill', get_neutral_fill);
                    // keep me highlighted...
                    d3.selectAll('.ccode_' + d.properties.COWCODE)
                        .style('fill', get_hover_fill);

                    selected_elements([]);
                    return;
                }
                selected_elements([d.trade_info]);
                focus_code = d.properties.COWCODE;

                // make everything invisible
                d3.selectAll('.feature')
                    .filter(function(e){ return e.properties.COWCODE !== d.properties.COWCODE;})
                    .style('display', 'none')

                // except countries related to this one
                d.trade_info.links.forEach(function (other) {
                    if (other[extrema.max.current_flow()] < 0) return;
                    d3.select('.ccode_' + other.ccode2)
                        .style('display', 'inline')
                        //// HACKY!
                        .filter(function(d) {return d.valid;})
                        .each(function(d) {
                            d.trade_info.flow1 = other.flow1;
                            d.trade_info.flow2 = other.flow2;})
                        .style('fill', get_highlight_fill)
                });
            })
            ;
        }
        return geo;
    }


    // from http://techslides.com/d3-map-starter-kit
    function move() {
      var t = d3.event.translate;
      var s = d3.event.scale;
      zscale = s;
      var h = 0;


      t[0] = Math.min(
        (width/height)  * (s - 1),
        Math.max( width * (1 - s), t[0] )
      );

      t[1] = Math.min(
        h * (s - 1) + h * s,
        Math.max(height  * (1 - s) - h * s, t[1])
      );

      zoom.translate(t);
      g.attr("transform", "translate(" + t + ")scale(" + s + ")");
    }


    return geo;
}




/********************************************************** TODO HIVE PLOT */
function hp_vis(root, dm, width, height) {
    var svg, g,
        data_man = dm,
        root = root,
        lasso = d3.lasso(),
        year = '1870';
    width = width ? width : 700,
    height = height ? height : 700;

    vis = function () {
        if (svg !== undefined) svg.remove();
        data_man.call_with_data(year, draw);
        return vis;
    }

    vis.g = function() { return g; }
    vis.svg = function() { return svg; }
    vis.year = function (_) {
        if (!arguments.length) return year;
        year = _;
        return vis;
    }

    // change scale, recolor
    vis.current_flow = function(current_flow) {
        extrema.max.year(year);
        extrema.min.year(year);

        extrema.min.current_flow(current_flow);
        extrema.max.current_flow(current_flow);
        extrema_reflow();
        return vis;
    }

    draw = function(graph, by_ccode) {
        extrema.max.year(year);
        extrema.min.year(year);
        svg = root.append('svg')
            .attr('width', width)
            .attr('height', height);





    var g = svg.append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    var hive_plot = mk_hive_plot()
            .svg(g)
            .innerRadius(20)
            .outerRadius(width/2 - 30)
            .node_height(6)
            .node_width (6);


    ///////////
    //
    deg_minmax = find_degree        (graph.nodes, graph.links, true);
    nn_minmax  = find_next_neighbors(graph.nodes, graph.links);
    cc_minmax  = find_cc            (graph.nodes, graph.links);
    graph.nodes[deg_minmax.max].max_by_deg = true;
    graph.nodes[nn_minmax .max].max_by_nn = true;



    var angle = d3.scale.ordinal().domain(d3.range(0,3))
            .rangePoints([0, 4/3 * Math.PI]),
        radius = d3.scale.linear()
            .range ([hive_plot.innerRadius(), hive_plot.outerRadius()])
            .domain([deg_minmax.min_val, deg_minmax.max_val]);

    //clone axes
    var rng = angle.range();
    rng[0] = [rng[0], rng[0] - Math.PI / 6];
    rng[2] = [rng[2]];
    rng[1] = [rng[1]];
    angle.range(rng);

    function nada() {return;}
    var col_high = "red",
        col_low = "#444";
    hive_plot
        .angle(angle)
        .radius(radius)
        .nodes(graph.nodes)
        .links(graph.links)
        .toggle_select_node(toggle_select_node)
        .elem_radius(function(d) { return radius(d.deg); })
        .elem_angle(function(d) { return angle(
            (d.deg_in === 0 && d.deg_out > 0) ? 2 :
            (d.deg_out === 0 && d.deg_in > 0) ? 1 :
            0
            ); })
        .elem_color(function(d, i, islink) {
            if (islink) d = graph.nodes[d.source];
            return !islink ? col_high : d.max_targets ? col_high : col_low;
        });
    hive_plot();



    g.selectAll("text.axis-label")
        .data(angle.range())
      .enter().append("text")
        .attr("class", "axis-label")
        .attr("x", function (d) { return 1.1 * hive_plot.outerRadius() * Math.cos(d3.mean(d)); })
        .attr("y", function (d) { return 1.1 * hive_plot.outerRadius() * Math.sin(d3.mean(d)); })
        .attr("text-anchor", "end")
        .style("font-weight", "bold")
        .text( function(d,i) { return i === 2 ? "in=0"
            : i == 1 ? "out=0" : "in/out"; } );








        // make lasso
        var lasso_area = g.append("rect")
                .attr("x", -width/2)
                .attr("y", -height/2)
                .attr("width",width)
                .attr("height",height)
                .style("opacity",0);
        lasso.items(g.selectAll('.node'))
            .closePathDistance(75)
            .closePathSelect(true)
            .hoverSelect(true)
            .area(lasso_area)
            .on("start",lasso_start) // lasso start function
            .on("draw",lasso_draw) // lasso draw function
            .on("end",lasso_end); // lasso end function
        g.call(lasso);
    }



    // Lasso functions to execute while lassoing
    var lasso_start = function() {
      lasso.items()
        .classed({"not_possible":true,"selected":false}); // style as not possible
    };

    var lasso_draw = function() {
  // Style the possible dots
  lasso.items().filter(function(d) {return d.possible===true})
      .style("stroke", "grey")
      .style("stroke-width", "6")
    .classed({"not_possible":false,"possible":true});

  // Style the not possible dot
  lasso.items().filter(function(d) {return d.possible===false})
      .style("stroke", "none")
    .classed({"not_possible":true,"possible":false});
    };

    var lasso_end = function() {
      // selected
        var selected = [];
      lasso.items().filter(function(d) {return d.selected===true})
        .classed({"not_possible":false,"possible":false})
        .each(function(d, i){toggle_select_node(d, i); selected.push(d);});

        selected_elements([]);
        selected_elements(selected);

      // not selected
      lasso.items().filter(function(d) {return d.selected===false})
        .classed({"not_possible":false,"possible":false})
        .each(toggle_select_node);

    };


    //TODO  use quick node size animation to double highlight
    function toggle_select_node(d, i) {
        if (d.selected) {
            d3.selectAll(".node_" + i).style("stroke", "black").style("stroke-width", 6);
            console.log(d, i)
        }
        else
            d3.selectAll(".node_" + i).style("stroke", "none");
    }





    return vis;
}








function mk_data_man () {
    var jsons = {}, seek_ccode = {}
        to_fname = function (year) { return 'data/' + year + '.json'; };

    var man = function () {
        return man;
    }

    man.jsons = function(){return jsons;}

    man.seek_ccode = function (year) {
        return seek_ccode[''+year];
    }

    man.call_with_data = function (year, f) {
        year = ''+year;
        if (typeof jsons[year] === "undefined") {
            download_data(year, f);
        } else {
            f(jsons[year], seek_ccode[year]);
        }
        return man;
    }

    man.to_fname = to_fname;

    var download_data = function (year, f) {
        year = ''+year;

        console.log('reading file ' + data_man.to_fname(year));
        d3.json(to_fname(year), function(error, data) {
            if (error) { console.log(error); return; }
            jsons[year] = data;

            var y = extrema.max.year();
            extrema.max.year(year);
            extrema.min.year(year);
            // process C.O.W. trade data for the year
            seek_ccode[year] = data.nodes.map(function(n) {
                // find max flow1, flow2
                //// TODO
                ///////////////////////// move comparison code to extrema_keeper
                /////// extrema keeper should hold min & max!!!
                /////////// make more extrema for flow_totals
                n.links.forEach(function(l) {
                if (l.flow1 > extrema.max.flow1()) extrema.max.flow1(l.flow1);
                if (l.flow2 > extrema.max.flow2()) extrema.max.flow2(l.flow2);

                if (l.flow1 < extrema.min.flow1() && n.flow1 > 0)
                    extrema.min.flow1(l.flow1);
                if (l.flow2 < extrema.min.flow2() && n.flow2 > 0)
                    extrema.min.flow2(l.flow2);
                });
                n.year = year;

                return n.ccode;
            });
            extrema_reflow();
            f(jsons[year], seek_ccode[year]);

            extrema.max.year(y);
            extrema.min.year(y);
        });
        return man;
    }

    return man;
}


















