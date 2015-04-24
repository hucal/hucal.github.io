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
function compact_money(n) { return '$' + compact_frm(n * 1E6)};

var frm = d3.format(',.5r')
function money(n) { return frm(n) + ' million USD'; }

var translate_flow = {
    flow1 : 'imports',
    flow2 : 'exports',
    diff21: 'surplus (exports - imports)',
    diff12: 'deficit (imports - exports)'}


// color management
var categories = 5,
    color = {
    natural: d3.scale.ordinal().domain(d3.range(categories + 1))
        .range(colorbrewer.YlGnBu[categories + 2].slice(1)),
    integer: d3.scale.ordinal().domain(d3.range(categories + 1))
        .range(colorbrewer.RdBu[categories + 1])
    };


var extrema_quant_scale = d3.scale.linear()
    .interpolate(interpolateFloor)
    .range(d3.range(0,3)).clamp(true);

var extrema_quantile = function(d, flow, suffix) {
    if (!arguments.length) flow = extrema.max.current_flow();
    var prevFlow = extrema.max.current_flow(),
        a = extrema.min();
        b = extrema.max();
    extrema.max.current_flow(flow);
    extrema.min.current_flow(flow);
    var r = extrema_quant_scale.domain(d3.range(a, b, (b - a)/3))
        (extrema.max.node_flow({trade_info:d}, suffix))
    extrema.max.current_flow(prevFlow);
    extrema.min.current_flow(prevFlow);
    return r;
}




function mk_trade_assigners(nn_minmax, deg_minmax, cc_minmax, radius, angle, thisYear) {
    var as = mk_assigners(nn_minmax, deg_minmax, cc_minmax, radius, angle);
    delete as.radius_assign.by_b;
    delete as.axis_assign.by_a;

    as.axis_assign.by_total_imports = function(d,i)
    { return angle(extrema_quantile(d, 'flow1', '_total')); }
    as.axis_assign.by_total_exports = function(d,i)
    { return angle(extrema_quantile(d, 'flow2', '_total')); }
    as.axis_assign.by_deficit = function(d,i)
    { return angle(extrema_quantile(d, 'diff12', '_total')); }
    as.axis_assign.by_surplus = function(d,i)
    { return angle(extrema_quantile(d, 'diff21', '_total')); }


    as.radius_assign.by_total_imports = mk_flow_assign('flow1')
    as.radius_assign.by_total_exports = mk_flow_assign('flow2');
    as.radius_assign.by_deficit = mk_flow_assign('diff12');
    as.radius_assign.by_surplus = mk_flow_assign('diff21');

    function mk_flow_assign(flow) {
            return function(d) {
            var prevYear = extrema.max.year();
            var prevFlow = extrema.max.current_flow();
            extrema.max.year(thisYear);
            extrema.min.year(thisYear);
            extrema.min.current_flow(flow);
            var r = radius(extrema.max.node_flow({trade_info:d}, '_total')
                    / (extrema.max() - extrema.min()));
            extrema.max.year(prevYear);
            extrema.min.year(prevYear);
            extrema.max.current_flow(prevFlow);
            return r;
        }
    }

    return as
}





function mk_tips(g, process_data, selector, has_hover_fill) {
    // rm tooltips
    g.selectAll('.d3-tip').remove();
    // make tooltips
    var tip = d3.tip()
      .attr('class', 'd3-tip')
      .direction('e')
      .offset([-10, 0])
      .html(function(d) {
            if (typeof d === 'undefined' || typeof d.name === 'undefined')
                return '<p>No data for this year</p>'
            else
                return '<p>' +
                d.name
                + '</p><p>Imports are  ' +
                money(d.flow1_total)
                + '</p><p>Exports are  ' +
                money(d.flow2_total)
                + '</p>';
        });


    g.call(tip);
    g.selectAll(selector)
        .on("mouseover", function(d) {
            if (has_hover_fill)
                d3.select(this).style('fill', get_hover_fill)
            tip.show(process_data(d));
        })
    g.selectAll(selector)
        .on("mouseout", function(d,i) {
            if (has_hover_fill && +focus_code !== +d.properties.COWCODE) {
                d3.select(this)
               .style('fill', focus_code ? get_highlight_fill : get_neutral_fill);
            }
            tip.hide(process_data(d));
        })
    return tip;
}


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
       .text(function (ft) { return translate_flow[ft[0]]
           + ': ' + money(ft[1](d.flow1_total, d.flow2_total)); })
   });

    return ws_data;
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
        .rangeRound(d3.range(categories + 1))
        .clamp(true)
        ;
}



function basic_stats() {
    return { 'flow1': min, 'flow2': min };
}

function extreme_keeper () {
    var flows = {},
        current_flow = 'diff12',
        global_min = basic_stats(),
        year = '1950'
        flow_types = {
        flow1 : function(f1, f2) {return f1;},
        flow2 : function(f1, f2) {return f2;},
        diff21 : function(f1, f2) {return f2 - f1;},
        diff12 : function(f1, f2) {return f1 - f2;},
        //'diff21rel' : function(f1, f2) {return (f2 - f1)/(f1 + f2);},
        //'diff12rel' : function(f1, f2) {return (f1 - f2)/(f1 + f2);},
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

    stat.node_flow = function (d, suffix) {
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
var focus_code = undefined,
    get_hover_fill = 'black';

function geo_vis(root, topology, dm, width, height) {
    var path, svg, g, projection,
        data_man = dm,
    tips,
        topology = topology,
        year = '1870';
    ////wtf....
        width = width ? width : 600,
        height = height ? height : 333;
        //focus_code = undefined,
        // zoom = d3.behavior.zoom()
        //     .scaleExtent([0.9, 10])
        //     .on("zoom", move);

        projection = d3.geo.conicEqualArea()
            .translate([width / 2, height * 0.7]);

        path = d3.geo.path()
            .projection(projection);

    var draw;
    geo = function() {
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
        root.selectAll('svg').remove();
            d3.selectAll('div.d3-tip.n').remove();

        extrema.max.year(year);
        extrema.min.year(year);

        svg = root.append('svg')
            .attr('width', width)
            .attr('height', height)
            ;
//            .call(zoom);

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


        g = svg.append('g')
            .attr('transform', 'scale(0.8)translate(0,90)');



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


        function toggle_trade_info(d, i) {
            d3.select(this).each(function (_) {
                if (focus_code === d.properties.COWCODE) {
                    // clear effects of highlighting
                    d3.selectAll('.ccode_' + focus_code)
                        .each(unselect_node);

                    focus_code = undefined;
                    g.selectAll('.feature')
                        .style('display', 'inline')
                        .style('fill', get_neutral_fill);
                    // keep me highlighted...
                    g.selectAll('.ccode_' + d.properties.COWCODE)
                        .style('fill', get_hover_fill);

                    selected_elements([]);
                    return;
                }
                selected_elements([d.trade_info]);
                focus_code = d.properties.COWCODE;


                d3.selectAll('.ccode_' + focus_code)
                    .each(select_node);

                // make everything invisible
                g.selectAll('.feature')
                    .filter(function(e){ return e.properties.COWCODE !== d.properties.COWCODE;})
                    .style('display', 'none')

                // except countries related to this one
                d.trade_info.links.forEach(function (other) {
                    if (other[extrema.max.current_flow()] < 0) return;
                    g.selectAll('.ccode_' + other.ccode2)
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
            select_node(d, i);
        }


        delete tips;
        tips = mk_tips(g, function(d){return d.trade_info;}, '.feature', true)

        // add color legend
        var col = color[extrema.max.color_type()];

        draw_color_legend("Color scheme", function (d, i) {
            var r = compact_money(flow_scale.invert(d));
            if (i === categories) r = '>' + r;
            if (i === 0) r = '<' + r;
            return r;
        }, col, root, 30);


        // add controls
        //

        d3.selectAll('#map_controls input[name=flow_type]')
            .each(function(){
                e = d3.select(this);
                if (e.attr('value') === extrema.max.current_flow())
                    e.attr("checked", "checked");
            })
            .attr('onchange', 'ggg.current_flow(this.value)()')

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
        assigners,
        hive_plot,
        tips,
        data_man = dm,
        panning = false,
        root = root,
        scale = 1.0,
        radius_assign = 'by_total_exports',
        axis_assign = 'by_total_imports',
        lasso = d3.lasso(),
        year = '1870';
    width = width ? width : 400,
    height = height ? height : 400;

    vis = function () {
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

    vis.panning = function (_) {
        if (!arguments.length) return panning;
        panning = _;
        return vis;
    }

    vis.reset_view = function (_) {
        if (svg !== undefined) {
            svg.select('g')
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
        }
    }

    vis.scale = function (_) {
        if (!arguments.length) return scale;
        scale = _;
        if (svg !== undefined) {
            svg.select('g')
                .attr("transform", "scale(" + scale + ")" + svg.select('g')
                        .attr('transform').replace(/scale\(.*\)/g, ''))
                .selectAll('rect.node')
                .attr('width', hive_plot.node_width() / scale);
            svg.selectAll('.link')
                .attr('stroke-width', 1.5 / scale);
        }
        return vis;
    }


    vis.assigners = function(_) {
        if (!arguments.length) return assigners;
        assigners = _;
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

    // change scale, recolor
    vis.radius_assign = function(_) {
        if (!arguments.length) return radius_assign;

        if (assigners.radius_assign.hasOwnProperty(radius_assign)) {
            radius_assign = _;
            data_man.call_with_data(year, draw);
        }
        return vis
    }
    // change scale, recolor
    vis.axis_assign = function(_) {
        if (!arguments.length) return axis_assign ;

        if (assigners.axis_assign.hasOwnProperty(axis_assign)) {
            axis_assign = _;
            data_man.call_with_data(year, draw);
        }
        return vis
    }


    draw = function(graph, by_ccode) {
            root.selectAll('svg').remove();
            d3.selectAll('div.d3-tip.n').remove();

    extrema.max.year(year);
    extrema.min.year(year);
    svg = root.append('svg')
        .attr('width', width)
        .attr('height', height);




    var g = svg.append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    var zoom = d3.behavior.zoom()
        .scaleExtent([1.0,1.0])
        .on('zoom', function() {
            if (!panning) return;
            var t = d3.event.translate;
            g.attr('transform', 'translate(' + t + ')scale(' + scale + ')'
                        )
        })
    g.call(zoom)

    var lasso_area = g.insert("rect")
            .attr("x", -width/2)
            .attr("y", -height/2)
            .attr("width",width)
            .attr("height",height)
                .style("opacity",0);

    hive_plot = mk_hive_plot()
            .innerRadius(20)
            .outerRadius(width/2 - 45)
            .node_height(6)
            .node_width (6);

    var angle = d3.scale.ordinal().domain(d3.range(0,3))
            .rangePoints([0, 4/3 * Math.PI]),
        radius = d3.scale.linear()
            .range ([hive_plot.innerRadius(), hive_plot.outerRadius()])
            .clamp(true);




    ///////////
    //

    var minmax = data_man.minmax(year);
    graph.nodes[minmax.deg.max].max_by_deg = true;
    graph.nodes[minmax.nn.max].max_by_nn = true;


    var rng = angle.range();
    //clone axes
    get_cloned(axis_assign).cloned
        .map(function (i) { rng[i] = [rng[i], rng[i] - Math.PI/6]; });
    get_cloned(axis_assign).not
        .map(function (i) { rng[i] = [rng[i]]; });
    angle.range(rng);

    assigners = mk_trade_assigners(minmax.nn, minmax.deg, minmax.cc, radius, angle, year);

    function nada() {return;}
    var col_high = "red",
        col_low = "#444";
    hive_plot
        .svg(g)
        .angle(angle)
        .radius(radius)
        .nodes(graph.nodes)
        .links(graph.links)
        .toggle_select_node(function(){return;})
        .elem_radius(assigners.radius_assign[radius_assign])
        .elem_angle(assigners.axis_assign[axis_assign])
        .elem_color(function(d, i, islink) {
            if (islink) d = graph.nodes[d.source];
            return !islink ? col_high : d.max_targets ? col_high : col_low;
        });
    hive_plot();

    g.selectAll('.node')
        .attr('class', function(d,i) {
            return d3.select(this).attr('class') + ' ccode_' + d.ccode;
        })



    g.selectAll("text.axis-label")
        .data(angle.range())
      .enter().append("text")
        .attr("class", "axis-label")
        .attr("x", function (d) { return 1.1 * hive_plot.outerRadius() * Math.cos(d3.mean(d)); })
        .attr("y", function (d) { return 1.1 * hive_plot.outerRadius() * Math.sin(d3.mean(d)); })
        .attr("text-anchor", "end")
        .style("font-weight", "bold")
        .text( assigners.axis_text[axis_assign] )







    // make lasso

    lasso.items(g.selectAll('.node'))
        .closePathDistance(75)
        .closePathSelect(true)
        .hoverSelect(true)
        .area(lasso_area)
        .on("start",lasso_start) // lasso start function
        .on("draw",lasso_draw) // lasso draw function
        .on("end",lasso_end); // lasso end function
    g.call(lasso);

    delete tips;
    tips = mk_tips(g, function(d){return d;}, 'rect.node')

    d3.select('#hp_controls input#panning')
        .attr("onchange", "hhh.panning(this.checked); ")

    d3.select('#hp_controls button#reset_view')
        .attr('onclick', "hhh.reset_view();");

    d3.select('#hp_controls select#sel_scale')
        .attr("onchange", "hhh.scale(this.value)")
        .selectAll("option")
        .data(d3.range(4.0, 0, -0.5))
      .enter().append("option")
        .each(function(d) { if (d === 1.0)
            d3.select(this).attr("selected", "selected"); })
        .attr("value", function(i) {return i;})
        .text(function(i) {return i;});

    d3.select("#hp_controls select#axis_func")
        .attr("onchange", "hhh.axis_assign(this.value);")
        .selectAll("option")
        .data(obj_keys(assigners.axis_assign))
      .enter().append("option")
        .each(function(d) { if (d === axis_assign)
            d3.select(this).attr("selected", "selected"); })
        .attr("value", function(i) {return i;})
        .text(function(i) {return i.replace(/_/g, " ");});

    d3.select("#hp_controls select#radius_func")
        .attr("onchange", "hhh.radius_assign(this.value);")
        .selectAll("option")
        .data(obj_keys(assigners.radius_assign))
      .enter().append("option")
        .each(function(d) { if (d === radius_assign)
            d3.select(this).attr("selected", "selected"); })
        .attr("value", function(i) {return i;})
        .text(function(i) {return i.replace(/_/g, " ");});


    }



    // Lasso functions to execute while lassoing
    var lasso_start = function() {
        if (panning) {
            d3.selectAll('.lasso').style('display', 'none');
        } else {

            d3.selectAll('.lasso').style('display', 'block');
        }
      lasso.items()
        .classed({"not_possible":true,"selected":false}); // style as not possible
    };

    var lasso_draw = function() {
        if (panning) return;
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
        if (panning) return;
      // selected
        var selected = [];
      lasso.items().filter(function(d) {return d.selected===true})
        .classed({"not_possible":false,"possible":false})
        .each(function(d, i){select_node(d, null); selected.push(d);});

      console.log('selected ', selected.length);
        selected_elements(selected);

      // not selected
      lasso.items().filter(function(d) {return d.selected===false})
        .classed({"not_possible":false,"possible":false})
        .each(unselect_node);

    };


    return vis;
}



//TODO  use quick node size animation to double highlight
function select_node(d, i) {
        d3.selectAll('div#hp_vis').selectAll(".ccode_" + d.ccode).style("stroke", "black").style("stroke-width", 6);

        d3.selectAll("div#geo_vis").selectAll(".ccode_" + d.ccode)
                    .style('fill', get_hover_fill)
    }
function unselect_node(d, i) {
        d3.selectAll('div#hp_vis').selectAll(".ccode_" + d.ccode).style("stroke", "none")

        d3.selectAll("div#geo_vis").selectAll(".ccode_" + d.ccode)
                    .style('fill', function(d,i) { return
                        focus_code ? ((focus_code == d.ccode) ? get_hover_fill : get_highlight_fill) : get_neutral_fill});
    }










function mk_data_man () {
    var jsons = {}, seek_ccode = {}, minmax = {},
        to_fname = function (year) { return 'data/' + year + '.json'; };

    var man = function () {
        return man;
    }

    man.jsons = function(){return jsons;}

    man.minmax = function (year) {
        return minmax[''+year];
    }

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
            minmax[year] = {
                deg: find_degree(data.nodes, data.links, true),
                nn: find_next_neighbors(data.nodes, data.links),
                cc: find_cc(data.nodes, data.links)
            };

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


















