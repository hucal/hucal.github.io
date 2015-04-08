//// need String.startsWith
if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) === 0;
  };
}


/********************************************************** */
var ws = d3.select('#elements_info');

function selected_elements(elems) {
    var ws_data = ws.selectAll('.element_info')
        // don't identify data using its list index
        .data(elems, function(d) { return d.trade_info.ccode; });

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
   .text(function (d) { return d.trade_info.name + ' - ' + d.trade_info.year; });

   var flows = [],
       dic = extrema.max.flow_types();
   for (var k in dic)
       flows.push([k, dic[k]]);
   ws_new.each(function (d) {
       d = d.trade_info;
       ws_new.selectAll('p')
       .data(flows)
       .enter().append('p')
       .text(function (ft) { return ft[0] + ': ' +
           ft[1](d.flow1_total, d.flow2_total); })
   });

    return ws_data;
}








/***************************************************** COLOR AND DATA RANGE **/
var compact_frm = d3.format('.1s');
function compact_money(n) { return compact_frm(n * 1E6) + ' USD'};

var frm = d3.format(',.2f')
function money(n) { return frm(n) + ' million USD'; }






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

var flow_scale;

function get_highlight_fill(d, i){
    return color[extrema.max.color_type()](flow_scale(
                extrema.min.node_flow(d)));
}
function get_neutral_fill(d, i){
    if (!d.valid) return 'url(#diagonal_hatch)';
    return color[extrema.max.color_type()](flow_scale(
                extrema.min.node_flow(d, '_total')));
}


function recalc_extrema() {
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



// globals for scaling and the focused node
var min = 0.0000001,
    extrema = { min: extreme_keeper(), max: extreme_keeper() };

function basic_stats() {
    return { 'flow1': min, 'flow2': min };
}

function extreme_keeper () {
    var flows = {},
        current_flow = 'diff12',
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

// color management
var categories = 5,
    color = {
    natural: d3.scale.ordinal().domain(d3.range(categories + 1))
        .range(colorbrewer.RdPu[categories + 1]),
    integer: d3.scale.ordinal().domain(d3.range(categories + 1))
        .range(colorbrewer.RdYlGn[categories + 1])
};






/********************************************************** YEAR SWITCHER */

/********************************************************** GEO VIS */
function geo_vis(root, data, width, height) {
    var path, svg, g, projection,
        trade_data = data,
        width = width ? width : 800,
        height = height ? height : 500,
        focus_code,
        zoom = d3.behavior.zoom()
            .scaleExtent([1, 10])
            .on("zoom", move);

        projection = d3.geo.conicEqualArea()
            .translate([width / 2, height * 0.7]);

        path = d3.geo.path()
            .projection(projection);

    geo = {};

    geo.trade_data = function(_) {
        if (!arguments.length) return trade_data;
        trade_data = _;
        return geo;
    }

    geo.g = function() { return g; }
    geo.svg = function() { return svg; }

    geo.current_flow = function(current_flow) {
        extrema.min.current_flow(current_flow);
        extrema.max.current_flow(current_flow);
        recalc_extrema();
        //// HELP!!!! TODO NO WORK
        draw_palette(g, width, height);
        g.selectAll('.feature')
            .style('fill', focus_code ? get_highlight_fill
                                      : get_neutral_fill);
        return geo;
    }

    geo.draw = function () {
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


        var focus_code = undefined;

        extrema.max.year(fname.replace('.json',''));

        g = svg.append('g');

        g.append('rect')
            .attr('class', 'background')
            .attr('width', width)
            .attr('height', height);


        get_hover_fill = 'black';

        // read map containing C.O.W. country IDs
        d3.json('data/cshapes_q4.topo.json', function(error, topology) {
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

            // used for searching for nodes by ccode
            var seek_ccode_trade;

            ///////////// TODO read trade.nodes elsewhere
            // read C.O.W. trade data for a certain year
            seek_ccode_trade = trade_data.nodes.map(function(n) {
                // find max flow1, flow2
                n.links.forEach(function(l) {
                if (l.flow1 > extrema.max.flow1()) extrema.max.flow1(l.flow1);
                if (l.flow2 > extrema.max.flow2()) extrema.max.flow2(l.flow2);

                if (l.flow1 < extrema.min.flow1() && n.flow1 > 0)
                    extrema.min.flow1(l.flow1);
                if (l.flow2 < extrema.min.flow2() && n.flow2 > 0)
                    extrema.min.flow2(l.flow2);
                });

                return n.ccode;
            });
            recalc_extrema();

            draw_palette(g, width, height);

            // match each trade record with corresponding country element
            g.selectAll('g.country')
            .each(function(d) {

                var node_ix = seek_ccode_trade.indexOf(d.properties.COWCODE);
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
                d.trade_info.year = trade_data.year;
                selected_elements([d]);
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






/********************************************************** SANKEY */
/*
var margin = {top: 10, right: 210, bottom: 10, left: 210},
    width = 1350 - margin.left - margin.right,
    height = 5000 - margin.top - margin.bottom,
    layout_pad = margin.left;

var  color = d3.scale.category20();

// append the svg canvas to the page
var svg = d3.select('div#vis').append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
  .append('g')
    .attr('transform',
          'translate(' + margin.left + ',' + margin.top + ')');




d3.json('data/' + fname, function(error, trade_data) {
    if (error) {
        console.log(error);
        return;
    }
    var data = trade_data.nodes;
    data.forEach(function (d) {
        d.targetLinks = [];
        d.sourceLinks = [];
        d.selected = false;
    });

    function mk_graph(get_weight)
    {
    graph = {
        links: [], nodes: []
    };

    $('button[name=clear-all]').click(function (ev) {
        d3.selectAll('.link')
            .attr('stroke', 'none');
    });

    // index nodes by their ccode
    by_ccode = [];
    data.forEach(function(d, i) {
        d.value = 40;
        by_ccode.push(d.ccode);
    });

    var nodes_left = data;
    var nodes_right = $.extend(true, [], data);
    nodes_left.forEach(function (d) {
        d.links.forEach(function (child) {
            var child_obj = nodes_right[by_ccode.indexOf(child.ccode2)];
            if (child_obj === undefined) return;
            if (child.flow1 > 0)
            graph.links.push({
                source: d,
                target: child_obj,
                value: get_weight(child, d)
            });
        });
    });

    nodes_left.sort(total_asc)
    graph.nodes = nodes_left.concat(nodes_right);
    return graph;
    }

    var graph_left  = mk_graph(function(c,d){return c.flow1});
    var graph_right = mk_graph(function(c,d){return c.flow2});

    d3.select('div#stats')
        .append('p')
        .text('Node count: ' + trade_data.nodes.length +
              '; left link count: ' +  graph_left.links.length +
              '; right link count: ' + graph_right.links.length);

    var sankey_left = d3.sankey()
        .nodeWidth(80)
        .nodePadding(20)
        .size([width/2 - layout_pad/2, height]);
    var sankey_right = d3.sankey()
        .nodeWidth(80)
        .nodePadding(20)
        .size([width/2 - layout_pad/2, height]);


    update(graph_left, sankey_left, svg);

    var svg_right = svg.append('g')
        .attr('transform', 'translate(' + (width/2 + layout_pad) + ',0)')

    update(graph_right, sankey_right, svg_right);

    function alphabetic_sort(a, b) { return a.name.localeCompare(b.name); }
    function total_dsc(a, b) {return d3.descending(a.flow2_total + a.flow1_total,
                                                  b.flow2_total + b.flow1_total); }
    function total_asc(a, b) {return d3.ascending(a.flow2_total + a.flow1_total,
                                                  b.flow2_total + b.flow1_total); }
});


function update(graph, sankey, parentelem) {
// Set the sankey diagram properties

// load the data
  sankey
      .nodes(graph.nodes)
      .links(graph.links)
      .layout(0);
    var path = sankey.link();

// add in the links
  var link = parentelem.append('g').selectAll('.link')
      .data(graph.links)
    .enter().append('path')
    .attr('class', function(d) {
        return 'link link_to_' + d.target.name.replace(/ /g, '_')
             + ' link_from_' + d.source.name.replace(/ /g, '_');
    })
      .attr('d', path)
      .attr('stroke', 'none')//function (d) {
      *//*
//		  return color(d.source.name.replace(/ .*/
//		  //, '')); })
//
/*
      .style('stroke-width', function(d) { return Math.max(1, d.dy); })
      .sort(function(a, b) { return b.dy - a.dy; });

// add the link titles
//  link.append('title');

// add in the nodes
  var node = parentelem.append('g').selectAll('.node')
      .data(graph.nodes)
    .enter().append('g')
      .attr('class', 'node')
      .attr('transform', function(d) {
		  return 'translate(' + d.x + ',' + d.y + ')'; })
      .on('click', function(d) {
        d.selected = !d.selected;
        d3.selectAll('.link_to_' + d.name.replace(/ /g, '_'))
            .attr('stroke', d.selected ? d.color : 'none');
      })
    ;
    node.filter(function(d) { return d.x < sankey.size()[0] / 2; })
      .on('click', function(d) {
        d.selected = !d.selected;
        d3.selectAll('.link_from_' + d.name.replace(/ /g, '_'))
            .attr('stroke', d.selected ? d.color : 'none');
      })

// add the rectangles for the nodes
  node.append('rect')
      .attr('height', function(d) { return d.dy + 1; })
      .attr('width', sankey.nodeWidth())
      .style('fill', function(d) {
		  return d.color = color(d.name.replace(/ .*/
//, '')); })
/*
      .style('stroke', function(d) {
		  return d3.rgb(d.color).darker(2); });

// add in the title for the nodes
  node.append('text')
      .attr('x', 6 + sankey.nodeWidth())
      .attr('y', function(d) { return d.dy / 2; })
      .attr('dy', '.35em')
      .attr('text-anchor', 'start')
      .attr('transform', null)
      .text(function(d) { return d.name; })
    .filter(function(d) { return d.x < sankey.size()[0] / 2; })
      .attr('x', -6)
      .attr('text-anchor', 'end');
}
*/

/********************************************************** HIVE PLOT */
