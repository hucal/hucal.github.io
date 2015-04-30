//// need String.startsWith
if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) === 0;
  };
}

var available_years = d3.range(1870, 2009, 3)

var all_hp_vis = [],
    all_map_vis = [];

// data and extrema managers
var data_man = mk_data_manager(),
    extrema = mk_extrema_manager({color_category_count: 5});

// globals for scaling and the focused node
var min = 0.0000001;

// COLOR AND DATA RANGE
var compact_frm = d3.format('.1s');
function compact_money(n) { return '$' + compact_frm(n * 1E6)};

var frm = d3.format('.5s')
function money(n) { return frm(n * 1E6) + ' USD'; }

var translate_flow = {
    flow1 : 'imports',
    flow2 : 'exports',
    diff21: 'surplus (exports - imports)',
    diff12: 'deficit (imports - exports)'}


// color management
var color = {
    natural: d3.scale.ordinal().domain(d3.range(extrema.color_category_count() + 1))
        .range(colorbrewer.YlGnBu[extrema.color_category_count() + 2].slice(1)),
    integer: d3.scale.ordinal().domain(d3.range(extrema.color_category_count() + 1))
        .range(colorbrewer.RdBu[extrema.color_category_count() + 1])
    };


function add_hp_help(root) {
    //

}

function add_map_help(root) {

}

function mk_hp_html(root, ix) {
 d3.select(root).append('div')
     .attr('class', 'vis hp_vis')
     .attr('id', 'hp_vis' + ix)
     .html([
       , "<div    class='controls'>"
       , "<span><button class='control' id='reset_view'>Reset view</button>         </span>"
       , "<span><input  class='control' id='panning' type='checkbox'>Panning enabled</span>"
       , "<span><select class='control' id='sel_scale'></select> Scale              </span>"
       , "<span><select class='control' id='sel_year'></select> Year                </span>"
       , "<span><select class='control' id='axis_func'> </select> Axis assignment   </span>"
       , "<span><select class='control' id='radius_func'></select> Radius assignment</span>"

       , "<span><input class='control' type=radio name='flow_type' value='flow1'> imports </span>"
       , "<span><input class='control' type=radio name='flow_type' value='flow2'> exports </span>"
       , "<span><input class='control' type=radio name='flow_type' value='diff21'> surplus</span>"
       , "<span><input class='control' type=radio name='flow_type' value='diff12'> deficit</span>"
       , "</div>"
     ].join('\n'));
}

function mk_map_html(root, ix) {
 d3.select(root).append('div')
     .attr('class', 'vis geo_vis controls')
     .attr('id', 'geo_vis' + ix)
     .html([
       , "<div class='controls'>"
       , "<span><button class='control' id='reset_view'>Reset view</button>               </span>"
       , "<span><select class='control' id='sel_year'></select>                           </span>"
       , "<span><input class='control' type=radio name='flow_type' value='flow1'> imports </span>"
       , "<span><input class='control' type=radio name='flow_type' value='flow2'> exports </span>"
       , "<span><input class='control' type=radio name='flow_type' value='diff21'> surplus</span>"
       , "<span><input class='control' type=radio name='flow_type' value='diff12'> deficit</span>"
       , "</div>"
     ].join('\n'));
}


function mk_trade_assigners(nn_minmax, deg_minmax, cc_minmax, radius, angle, thisYear) {
    var as = mk_assigners(nn_minmax, deg_minmax, cc_minmax, radius, angle);

    ///// LABELS
    as.axis_text.by_total_imports = mk_axis_label('flow1');
    as.axis_text.by_total_exports = mk_axis_label('flow2');
    as.axis_text.by_deficit = mk_axis_label('diff12');
    as.axis_text.by_surplus = mk_axis_label('diff21');

    function mk_axis_label(flow) {
        return function(d,i) {
            extrema.year(thisYear).type(flow)
            var a = extrema.quantile().domain()[i],
                b = i == 2 ? extrema.max() : extrema.quantile().domain()[i + 1];
            return compact_money(a) + ' to ' + compact_money(b);
        }
    }

    as.axis_assign.by_total_imports = function(d,i)
    { return angle(extrema.year(thisYear).type('flow1') .quantile()(extrema.node_flow(d))); }
    as.axis_assign.by_total_exports = function(d,i)
    { return angle(extrema.year(thisYear).type('flow2') .quantile()(extrema.node_flow(d))); }
    as.axis_assign.by_deficit = function(d,i)
    { return angle(extrema.year(thisYear).type('diff12').quantile()(extrema.node_flow(d))); }
    as.axis_assign.by_surplus = function(d,i)
    { return angle(extrema.year(thisYear).type('diff21').quantile()(extrema.node_flow(d))); }


    //// MAKE RELATIVE
    as.radius_assign.by_total_imports = mk_flow_assign('flow1')
    as.radius_assign.by_total_exports = mk_flow_assign('flow2');
    as.radius_assign.by_deficit = mk_flow_assign('diff12');
    as.radius_assign.by_surplus = mk_flow_assign('diff21');

    function mk_flow_assign(flow) {
            return function(d) {
            extrema.year(thisYear).type(flow);
            var r, q,
                q = extrema.node_quantile(d),
                min = ex.min(),
                max = ex.max(),
                v = extrema.type(flow).node_flow(d);

                r = v / (max - min);
                r = (r - q/3) * 3;
                r = radius(r);
            return r;
        }
    }

    return as
}

function mk_tips(g, process_data, selector, is_map_vis) {
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
                + '</p><p>Surplus (negative deficit)  ' +
                money(d.flow2_total - d.flow1_total)
                + '</p>';
    });

    g.call(tip);
    g.selectAll(selector)
        .on('mouseover', function(d) {
            if (is_map_vis)
                d3.select(this).style('fill', get_hover_fill)
            tip.show(process_data(d));
        })
    g.selectAll(selector)
        .on('mouseout', function(d,i) {
            if (is_map_vis) {
                d3.select(this).style('fill', all_map_vis[0].get_fill_func())
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


   var flowts = extrema.types();
   var ks = obj_keys(flowts);
   ws_new.each(function(d) {
       var eee = d3.select(this);
       ks.forEach(function(key) {
       eee.append('p')
       .text(translate_flow[key]
           + ': ' + money(flowts[key](d.flow1_total, d.flow2_total)))
   })
   })

    return ws_data;
}


/********************************************************** GEO VIS */
var get_hover_fill = 'yellow';

function geo_vis(topology, dm, width, height) {
    var path, svg, g, projection,
        data_man = dm,
        focus_code = undefined,
        index,
        root,
        current_flow = 'flow1',
        tips,
        topology = topology,
        year = '2008';
    ////wtf....
    var width = width ? width : 600,
        height = height ? height : 333;

        projection = d3.geo.conicEqualArea()
            .translate([width / 2, height * 0.7]);

        path = d3.geo.path()
            .projection(projection);

    var draw, first = true;
    geo = function(after) {
        if (first) mk_html_and_controls();
        first = false;
        data_man.call_with_data(year, !after ? draw :
                function(data,ccode){
                    draw(data,ccode);
                    after(data,ccode); // execute another function after data is loaded?
                });
        return geo;
    }

    geo.get_highlight_fill = function(d, i) {
        extrema.year(year).type(current_flow);
        return extrema.node_color(d.trade_info);
    }
    geo.get_neutral_fill = function(d, i, thiz) {
        var thiz = thiz || this;
        if (!d.valid) {
            d3.select(thiz).style('display', 'none');
            return 'black'
        }
        extrema.year(year).type(current_flow);
        return extrema.node_color(d.trade_info);
    }

    geo.get_fill_func = function() {
        return function(d,i) {
            if (focus_code && focus_code === d.trade_info.ccode)
                return get_hover_fill
            else if (focus_code) return geo.get_highlight_fill(d,i)
            else return geo.get_neutral_fill(d,i,this)
        }
    }

    geo.g = function() { return g; }
    geo.svg = function() { return svg; }
    geo.year = function (_) {
        if (!arguments.length) return year;
        year = _;
        return geo;
    }

    // change scale, recolor
    geo.current_flow = function(cf) {
        current_flow = cf

        extrema.year(year).type(cf);

        d3.selectAll('#geo_vis' + index + ' .legends').remove();

        draw_color_legend('Color scheme', function (d, i) {
            extrema.year(year).type(current_flow);
            var r = compact_money(extrema.get_color_scale().invert(d));
            if (i === extrema.color_category_count()) r = '>' + r;
            if (i === 0) r = '<' + r;
            return r;
        }, color[extrema.color_type()], root, 30);

        g.selectAll('.feature')
            .style('fill', geo.get_fill_func())
        return geo;
    }

    geo.reset_view = function() {
        g.selectAll('.feature')
            .style('fill', geo.get_fill_func())
    }

    var mk_html_and_controls = function() {
        if (typeof index == 'undefined')
            index = all_map_vis.length;
        mk_map_html('#map_vis_container', index);

        d3.select('#geo_vis' + index + ' .controls select#sel_year')
            .attr('onchange', 'all_map_vis[' + index + '].year(this.value)()')
            .selectAll('option')
            .data(available_years)
          .enter().append('option')
            .each(function (y) {
                // select current year
                if (''+y === ''+year)
                    d3.select(this).attr('selected', 'selected')
            })
            .attr('value', function(y) { return y; })
            .text(function(y) { return y; });

        d3.select('#hp_vis' + index + ' .controls button#reset_view')
            .attr('onclick', 'all_map_vis[' + index + '].reset_view();');

        d3.selectAll('#geo_vis' + index + ' .controls input[name=flow_type]')
            .each(function(){
                e = d3.select(this);
                if (e.attr('value') === current_flow)
                    e.attr('checked', 'checked');
            })
            .attr('onchange', 'all_map_vis[' + index + '].current_flow(this.value)');

        all_map_vis.push(geo);
        root = d3.select('#map_vis_container #geo_vis' + index);
        return geo;
    }

    geo.mk_html_and_controls = mk_html_and_controls ;

    draw = function(trade_data, by_ccode) {
        root.selectAll('svg').remove();
            d3.selectAll('div.d3-tip.n').remove();

        svg = root.append('svg')
            .attr('width', width)
            .attr('height', height)
            ;

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
            d3.select(this).style('fill', geo.get_fill_func())
        })

        // match each trade record with corresponding country element
        g.selectAll('g.country')
        .each(function(d) {
            var node_ix = by_ccode.indexOf(d.properties.COWCODE);
            if (node_ix < 0) {
                // not found in trade data nodes
                d.valid = false;
                d3.select(this).style('fill', geo.get_neutral_fill);
                return;
            }
            d.valid = true;
            d.trade_info = trade_data.nodes[node_ix];
            d.trade_info_on = false;
            d3.select(this)
                .style('fill', geo.get_neutral_fill)
                .on('click', toggle_trade_info);
        });


        function toggle_trade_info(d, i) {
            d3.select(this).each(function (_) {
                // clear effects of highlighting
                if (focus_code === d.properties.COWCODE) {
                    focus_code = undefined;
                    d3.selectAll('.ccode_' + focus_code)
                        .each(unselect_node);
                    g.selectAll('.feature')
                        .style('display', 'inline')
                    // keep this node highlighted
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
                //g.selectAll('.feature')
                //    .filter(function(e){ return e.properties.COWCODE !== d.properties.COWCODE;})
                //    .style('display', 'none')
                // highlight_related(d)
            });
        }

        delete tips;
        tips = mk_tips(g, function(d){return d.trade_info;}, '.feature', true)

        // add color legend


        draw_color_legend('Color scheme', function (d, i) {
            extrema.year(year).type(current_flow);
            var r = compact_money(extrema.get_color_scale().invert(d));
            if (i === extrema.color_category_count()) r = '>' + r;
            if (i === 0) r = '<' + r;
            return r;
        }, color[extrema.color_type()], root, 30);


        return geo;
    }

    function highlight_related(d) {
        // except countries related to selected
        d.trade_info.links.forEach(function (other) {
            if (extrema.type(current_flow).year(year).node_flow(d.trade_info) < 0) return;
            g.selectAll('.ccode_' + other.ccode2)
                .filter(function(d) {return d.valid;})
                .style('display', 'inline')
                .style('fill', function(d,i){ return
                    geo.get_highlight_fill(
                            {trade_info:{flow1_total:other.flow1, flow2_total:other.flow2}}, i); })
        })
    }

    return geo;
}




/********************************************************** TODO HIVE PLOT */
function hp_vis(dm, width, height) {
    var svg, g,
        assigners,
        hive_plot,
        tips,
        data_man = dm,
            root,
            current_flow = 'flow1',
        index,
        panning = false,
        root = root,
        scale = 1.0,
        radius_assign = 'by_total_exports',
        axis_assign = 'by_total_imports',
        lasso = d3.lasso(),
        year = '2008';
    width = width ? width : 500,
    height = height ? height : 400;

    var first = true;
    vis = function (after) {
        if (first) mk_html_and_controls();
        first = false;
        data_man.call_with_data(year, !after ? draw :
                function(data,ccode){draw(data,ccode);after(data,ccode)});
        return vis;
    }

    vis.g = function() { return g; }
    vis.svg = function() { return svg; }

    function col_high(d,i) { console.log(current_flow); return extrema.year(year).type(current_flow).node_color(d); };
    var col_low = '#444';

    vis.current_flow = function(cf) {
        current_flow = cf

        d3.selectAll('#hp_vis' + index + ' svg rect.node')
        .style('fill', function(d, i, islink) {
            if (islink) d = graph.nodes[d.source];
            return !islink ? col_high(d,i) : d.max_targets ? col_high : col_low;
        });

        d3.selectAll('#hp_vis' + index + ' .legends').remove();

        draw_color_legend('Color scheme', function (d, i) {
            extrema.year(year).type(current_flow);
            var r = compact_money(extrema.get_color_scale().invert(d));
            if (i === extrema.color_category_count()) r = '>' + r;
            if (i === 0) r = '<' + r;
            return r;
        }, color[extrema.color_type()], d3.select('#hp_vis' + index), 30);




        return vis;
    }
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
                .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
            }
        }

        vis.scale = function (_) {
            if (!arguments.length) return scale;
            scale = _;
            if (svg !== undefined) {
                svg.select('g')
                    .attr('transform', 'scale(' + scale + ')' + svg.select('g')
                            .attr('transform').replace(/scale\(.*\)/g, ''))
                    .selectAll('rect.node')
                    .attr('width', hive_plot.node_width() / scale);
                svg.selectAll('.link')
                    .attr('stroke-width', 1.5 / scale);
            }
            return vis;
        }

        // change scale, recolor
        vis.radius_assign = function(_) {
            if (!arguments.length) return radius_assign;

            radius_assign = _;
            if (!!assigners && assigners.radius_assign.hasOwnProperty(radius_assign)) {
                data_man.call_with_data(year, draw);
            }
            return vis
        }
        // change scale, recolor
        vis.axis_assign = function(_) {
            if (!arguments.length) return axis_assign ;

            axis_assign = _;
            if (!!assigners && assigners.axis_assign.hasOwnProperty(axis_assign)) {
                data_man.call_with_data(year, draw);
            }
            return vis
        }

       var mk_html_and_controls = function() {
            if (typeof index == 'undefined')
                index = all_hp_vis.length;
            mk_hp_html('#hp_vis_container', index);

            d3.select('#hp_vis' + index + ' .controls select#sel_year')
                .attr('onchange', 'all_hp_vis[' + index + '].year(this.value)()')
                .selectAll('option')
                .data(available_years)
                .enter().append('option')
                .each(function (y) {
                    // select current year
                    if (''+y === ''+year)
                        d3.select(this).attr('selected', 'selected')
                })
                .attr('value', function(y) { return y; })
                .text(function(y) { return y; });

            d3.select('#hp_vis' + index + ' .controls input#panning')
                .attr('onchange', 'all_hp_vis[' + index + '].panning(this.checked); ')

            d3.select('#hp_vis' + index + ' .controls button#reset_view')
                .attr('onclick', 'all_hp_vis[' + index + '].reset_view();');

            d3.selectAll('#hp_vis' + index + ' .controls input[name=flow_type]')
            .each(function(){
                e = d3.select(this);
                if (e.attr('value') === current_flow)
                    e.attr('checked', 'checked');
            })
            .attr('onchange', 'all_hp_vis[' + index + '].current_flow(this.value)');

            d3.select('#hp_vis' + index + ' .controls select#sel_scale')
                .attr('onchange', 'all_hp_vis[' + index + '].scale(this.value)')
                .selectAll('option')
                .data(d3.range(4.0, 0, -0.5))
              .enter().append('option')
                .each(function(d) { if (d === 1.0)
                    d3.select(this).attr('selected', 'selected'); })
                .attr('value', function(i) {return i;})
                .text(function(i) {return i;});

            root = d3.select('#hp_vis_container #hp_vis' + index);
            all_hp_vis.push(vis);
            return vis;
        }

        vis.mk_html_and_controls = mk_html_and_controls;

        draw = function(graph, by_ccode) {

        root.selectAll('svg').remove();
        d3.selectAll('div.d3-tip.n').remove();

        svg = root.append('svg')
            .attr('width', width)
            .attr('height', height);


        var g = svg.append('g')
            .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

        var zoom = d3.behavior.zoom()
            .scaleExtent([1.0,1.0])
        .on('zoom', function() {
            if (!panning) return;
            var t = d3.event.translate;
            t[0] *= scale;
            t[1] *= scale;
            g.attr('transform', 'translate(' + t + ')scale(' + scale + ')'
                        )
        })
    g.call(zoom)

    var lasso_area = g.insert('rect')
            .attr('x', -width/2)
            .attr('y', -height/2)
            .attr('width',width)
            .attr('height',height)
                .style('opacity',0);

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



    g.selectAll('text.axis-label')
        .data(angle.range())
      .enter().append('text')
        .attr('class', 'axis-label')
        .attr('x', function (d) { return 1.1 * hive_plot.outerRadius() * Math.cos(d3.mean(d)); })
        .attr('y', function (d) { return 1.1 * hive_plot.outerRadius() * Math.sin(d3.mean(d)); })
        .attr('text-anchor', 'end')
        .style('font-weight', 'bold')
        .text( assigners.axis_text[axis_assign] )



        // more controls, they need access to assigners
        d3.select('#hp_vis' + index + ' .controls select#axis_func')
            .attr('onchange', 'all_hp_vis[' + index + '].axis_assign(this.value);')
            .selectAll('option')
            .data(obj_keys(assigners.axis_assign))
          .enter().append('option')
            .each(function(d) { if (d === axis_assign)
                d3.select(this).attr('selected', 'selected'); })
            .attr('value', function(i) {return i;})
            .text(function(i) {return i.replace(/_/g, ' ');});

        d3.select('#hp_vis' + index + ' .controls select#radius_func')
            .attr('onchange', 'all_hp_vis[' + index + '].radius_assign(this.value);')
            .selectAll('option')
            .data(obj_keys(assigners.radius_assign))
          .enter().append('option')
            .each(function(d) { if (d === radius_assign)
                d3.select(this).attr('selected', 'selected'); })
            .attr('value', function(i) {return i;})
            .text(function(i) {return i.replace(/_/g, ' ');});


    // make lasso

    lasso.items(g.selectAll('.node'))
        .closePathDistance(75)
        .closePathSelect(true)
        .hoverSelect(true)
        .area(lasso_area)
        .on('start',lasso_start) // lasso start function
        .on('draw',lasso_draw) // lasso draw function
        .on('end',lasso_end); // lasso end function
    g.call(lasso);

    delete tips;
    tips = mk_tips(g, function(d){return d;}, 'rect.node')



        draw_color_legend('Color scheme', function (d, i) {
            extrema.year(year).type(current_flow);
            var r = compact_money(extrema.get_color_scale().invert(d));
            if (i === extrema.color_category_count()) r = '>' + r;
            if (i === 0) r = '<' + r;
            return r;
        }, color[extrema.color_type()], root, 30);






    }



    // Lasso functions to execute while lassoing
    var lasso_start = function() {
        if (panning) {
            d3.selectAll('.lasso').style('display', 'none');
        } else {

            d3.selectAll('.lasso').style('display', 'block');
        }
      lasso.items()
        .classed({'not_possible':true,'selected':false}); // style as not possible
    };

    var lasso_draw = function() {
        if (panning) return;
  // Style the possible dots
  lasso.items().filter(function(d) {return d.possible===true})
      .style('stroke', 'grey')
      .style('stroke-width', '6')
    .classed({'not_possible':false,'possible':true});

  // Style the not possible dot
  lasso.items().filter(function(d) {return d.possible===false})
      .style('stroke', 'none')
    .classed({'not_possible':true,'possible':false});
    };

    var lasso_end = function() {
        if (panning) return;
      // selected
        var selected = [];
      lasso.items().filter(function(d) {return d.selected===true})
        .classed({'not_possible':false,'possible':false})
        .each(function(d, i){select_node(d, null); selected.push(d);});

      console.log('selected ', selected.length);
        selected_elements(selected);

      // not selected
      lasso.items().filter(function(d) {return d.selected===false})
        .classed({'not_possible':false,'possible':false})
        .each(unselect_node);

    };

    return vis;
}



//TODO  use quick node size animation to double highlight
function select_node(d, i) {
        d3.selectAll('.hp_vis').selectAll('.ccode_' + d.ccode).style('stroke', get_hover_fill).style('stroke-width', 6);

        d3.selectAll('.geo_vis').selectAll('.ccode_' + d.ccode)
                    .style('fill', get_hover_fill)
    }
function unselect_node(d, i) {
        d3.selectAll('.hp_vis').selectAll('.ccode_' + d.ccode).style('stroke', 'none')

        d3.selectAll('.geo_vis').selectAll('.ccode_' + d.ccode)
                    .style('fill', all_map_vis[0].get_fill_func())
    }

function mk_data_manager () {
    var jsons = {}, seek_ccode = {}, minmax = {},
        to_fname = function (year) { return 'jsons_top40/' + year + '.json'; };

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
        if (typeof jsons[year] === 'undefined') {
            download_data(year, f);
        } else {
            f(jsons[year], seek_ccode[year]);
        }
        return man;
    }

    man.to_fname = to_fname;

    var download_data = function (year, f) {
        year = ''+year;

        d3.json(to_fname(year), function(error, data) {
            if (error) { console.log(error); return; }
            jsons[year] = data;
            minmax[year] = {
                deg: find_degree(data.nodes, data.links, true),
                nn: find_next_neighbors(data.nodes, data.links),
                cc: find_cc(data.nodes, data.links)
            };

            // process C.O.W. trade data for the year
            seek_ccode[year] = data.nodes.map(function(n) {
                n.links.forEach(function(l) {
                });
                extrema.year(year).type('flow1').update(n.flow1_total);
                extrema.year(year).type('flow2').update(n.flow2_total);
                n.year = year;

                return n.ccode;
            });
            f(jsons[year], seek_ccode[year]);
        });
        return man;
    }

    return man;
}








// initial options passed as dict
// runtime options managed using closure + get/set functions
function mk_extrema_manager(args){
    var type = 'flow1',
        year = '2008',
        extrema = {};
        color_category_count = args ? args.color_category_count : 5,


    type_funcs = {
        flow1 : function(f1, f2) {return f1;},
        flow2 : function(f1, f2) {return f2;},
        diff21 : function(f1, f2) {return f2 - f1;},
        diff12 : function(f1, f2) {return f1 - f2;},
    }
    ex = function() {
        return extrema[year] ? extrema[year][type] : extrema[year];
    }
    ex.data = function(){return extrema;}
    ex.types = function() { return type_funcs; }
    ex.color_category_count = function() { return color_category_count; }
    ex.type = function(_) {
        if (!arguments.length) return type;
        type = _;

        if (typeof extrema[year] === 'undefined')
            ex.year(year);
        if (typeof extrema[year][type] === 'undefined')
            extrema[year][type] = { max: 0, min: 0 };
        return ex;
    }
    ex.year = function(_) {
        if (!arguments.length) return year;
        year = _;
        if (typeof extrema[year] === 'undefined')
            extrema[year] = {};
        return ex;
    }

    ex.get_color_scale = function() {
        ex.year(year).type(type);
        if (typeof ex()['color_scale'] === 'undefined') {
            ex()['color_scale' ] = mk_color_scale();
        }
        return ex()['color_scale'];
    }

    function mk_color_scale() {
         return d3.scale.linear().clamp(true)
         .domain(d3.range(ex.min(), ex.max(),
                Math.abs(ex.max() - ex.min()) / (color_category_count + 1)
                ))
        .rangeRound(d3.range(color_category_count))
        ;

    }

    ex.quantile = function() {
        if (typeof ex()['quantile'] === 'undefined'){
            ex.year(year).type(type);
            ex()['quantile'] = mk_quantile();
        }
        return ex()['quantile'];
    }

    ex.node_quantile = function(d) {
        return ex.quantile()(ex.node_flow(d));
    }

    function mk_quantile() {
        var q = d3.scale.linear()
        .interpolate(interpolateFloor)
        .range(d3.range(0,3)).clamp(true);
        if (type.startsWith('diff')) {
            var a = ex.min(), b = ex.max(),
                c = Math.abs(ex.max() - ex.min()) / 3;
        var l = d3.range(ex.min(), ex.max(),
                Math.abs(ex.max() - ex.min()) / 3);
        q.domain(l);
        console.log(a,b,c,l)
        }
        else
        q.domain(d3.range(ex.min(), ex.max(),
                Math.abs(ex.max() - ex.min()) / 3))
        return q;
    }

    ex.node_flow = function(d) {
        return type_funcs[type](d['flow1_total'], d['flow2_total']);
    }

    ex.color_type = function () {
        if (type.startsWith('diff'))
            return 'integer';
        return 'natural'
    }

    ex.node_color = function(d) {
        return color[ex.color_type()](ex.get_color_scale()(ex.node_flow(d)))
    }

    ex.min = function() {
        var a = type_funcs[type](extrema[year]['flow1']['min'],
                                extrema[year]['flow2']['min']),

b=               type_funcs[type](extrema[year]['flow1']['max'],
                                extrema[year]['flow2']['max'])
            ;
        console.log(a,b)
        return Math.min(a,b)
    }

    ex.max = function() {
        return Math.max(type_funcs[type](extrema[year]['flow1']['min'],
                                extrema[year]['flow2']['min']),
                    type_funcs[type](extrema[year]['flow1']['max'],
                                extrema[year]['flow2']['max'])
                );
    }

    ex.update = function(n) {
        if (!type.startsWith('flow'))
            return;
        var exs = ex();
        if (n > exs['max'] && n >= 0)
            exs['max'] = n;
        if (n < exs['min'] && n >= 0)
            exs['min'] = n;
        return ex;
    }

    return ex;
}
