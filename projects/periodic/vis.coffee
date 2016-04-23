# toggle amount of info per box
#   main: symbol
#   add four more as grid (x x) (x x)
#   demonstrate using template
#
# grid numbers
#   period x group
#
# height range on legend
#   min .. max, filter
#
# select (with grid numbers, legend boxes, height range)
#   unselected -> fade

# Write
# links to wikipedia article, scraper
#   "Please do not use a web crawler to download large numbers of articles. Aggressive crawling of the server can cause a dramatic slow-down of Wikipedia."
# description of visualization
# more comments
# Credit: Bostock

# Call d3.json once the
# "document has finished loading (but not its dependent resources)"
vis = undefined
d3.select(document).on 'DOMContentLoaded', ->
    # Request JSON to be loaded and write the callback
    d3.json 'table.json', (error, elements) ->
        # Print them
        vis = mk_periodic_table()
        vis.root (d3.select('div.vis')
            .append('div').classed('periodic_table', true))
        vis elements
        return
    return

niceFormat = (n) ->
    if Math.log10(n) > 3
        d3.format(',.4s')(n)
    else
        d3.format(',.2f')(n)

interpolateFloor = (a, b) ->
    a = +a
    b = +b
    (t) -> Math.floor(a * (1 - t) + b * t)

perceivable_inverse = (col) ->
    c = d3.hcl col
    oc = d3.hcl col

    if col == 'black' or col == '#000' or col == '#000000'
        # kindof fixes bug with d3.hcl, d3.rgb, d3.lab, d3.hsl and the color black
        return 'white'
    if isNaN(c.h)
        return 'black'

    # Find the complementary color
    c.h = (360 - (180 + c.h)) - 180
    c.c = 100 - c.c
    c.l = 100 - c.l

    # Increase luminance difference between 'a' and its complementary color
    # Examples luminance pairs:
    #    a,   before (100% - a),    after
    #   0%,                100%,      101%
    #  12%,                 88%,    90.55%
    #  45%,                 55%,    88.81% <----
    #  49%,                 51%,    97.23% <---- why this is needed
    #  65%,                 35%,    19.53%
    diff = Math.sign(c.l- oc.l) * Math.exp(
        (Math.log 100) * (100 - Math.abs(c.l - oc.l))/100
    ) / 2
    c.l += diff
    c


mk_periodic_table = ->
    # Private variables
    svg = undefined
    g = undefined
    root = undefined
    layout = undefined
    tip = undefined
    control_container = undefined
    legend = undefined
    elementsData = undefined
    _height =
        path: null
        line: null

    # Sane defaults
    height = 600
    width = Math.round(height * (1 + Math.sqrt(5)) / 2)

    # Space needed: 10 down, 19 right
    elemSize = width / 19
    elemScale = 1.0

    margin =
        top: 5
        left: 5

    zoomed = false
    zoom = d3.behavior.zoom()
        .scaleExtent([0.5, 10])
        .center([(margin.left + width) / 2, (margin.top + height) / 2])
        .size([margin.left + width, margin.top + height])


    # Color palette. color[n] gives a palette for n categories (3 to 9)
    nCategories = 7
    colorPalette = colorbrewer.YlOrRd[nCategories]

    colClass = 'by_weight'
    heightClass = 'by_weight'

    classifiers =
        by_weight:
            # Function that extracts numerical value from node
            accessor: (d, _) ->
                if _? then d['atomicWeight'] = _ else d['atomicWeight']
            # Should be a dictionary from classifier names to d3.scales
            # classify: undefined
        by_electronegativity:
            accessor: (d, _) ->
                if _? then d['eneg'] = _ else d['eneg']
        by_boiling_point:
            accessor: (d, _) ->
                if _? then d['boilingPoint'] = _ else d['boilingPoint']
        by_melting_point:
            accessor: (d, _) ->
                if _? then d['meltingPoint'] = _ else d['meltingPoint']
        by_abundance:
            accessor: (d, _) ->
                if _? then d['abundance'] = _ else d['abundance']
        by_density:
            accessor: (d, _) ->
                if _? then d['density'] = _ else d['density']
        by_heat:
            accessor: (d, _) ->
                if _? then d['heat'] = _ else d['heat']

    prettyNames = [
        ['Atomic number', 'atomicNumber']
        ['Weight (amu)', 'atomicWeight']
        ['Boiling point (K)', 'boilingPoint']
        ['Melting point (K)', 'meltingPoint']
        ['Electronegativity', 'eneg']
        ['Abundance (mg/kg)', 'abundance']
    ]

    # Should map from [0,1] to {0..classifier.size - 1}
    floatToColor = undefined

    color = (d) ->
        if not colClass
            return 'white'
        c = classifiers[colClass]
        ix = floatToColor(c.classify( c.accessor d ))
        result = colorPalette[ix]
        if not result?
            result = perceivable_inverse colorPalette[nCategories - 1]
        result

    invertExtentColor = (d) ->
        c = classifiers[colClass]
        ix = colorPalette.indexOf(d)
        if ix < 0
            return '?'
        extent = floatToColor.invertExtent(ix)
        [c.classify.invert(extent[0]), c.classify.invert(extent[1])]

    # Prepare and activate d3.tip tooltips
    tip = d3.tip()
        .attr('class', 'd3-tip')
        .html((d) ->
            # Tooltip content. Nice labels and all data within d
            s = "<em>#{d.name} (#{ d.sym })</em><table>"

            for [name, prop] in prettyNames
                s += "<tr>
                <td>#{ name }:</td>
                <td>#{ if d[prop]? then d[prop] else '?'}</td>
                </tr>"
            s += '</table>'
            s )

    clearHighlights = ->
        g.each((d) ->
            d.highlighted = false
            colorElement(d, this))

    highlightElement = (d) ->
        colorElement(d, null, -> 'blue')
        d.highlighted = true

    # Set data and draw the visualization
    vis = (data) ->
        elementsData = data
        # Find range of classifiers
        for d in elementsData
            for k, v of classifiers
                val = v.accessor(d)
                if not val?
                    continue

                # Clean up the number
                val = parseFloat(val.replace('[', '').replace(']', ''))
                if isNaN(val)
                    continue
                # Set it
                v.accessor(d, val)

                if not v['max']? or v['max'] < val
                    v['max'] = val

                if not v['min']? or v['min'] > val
                    v['min'] = val

        # Define each classifier's classify() according to its range
        for k, v of classifiers
            step = (v['max'] - v['min']) / nCategories
            v['classify'] = d3.scale.linear()
                .clamp(true)
                .domain([v['min'], v['max']])
                .range([0,1])

        if colClass
            floatToColor = d3.scale.quantile()
                .domain([0,1]).range(d3.range(nCategories))

        # CLEAR THE ROOT
        root.selectAll('*').remove()

        # Append a new SVG
        svg = root.append 'svg'
            # Set dimensions, account for margins
            .attr('width', width + 2 * margin.left)
            .attr('height', height + 2 * margin.top)
            # Add class
            .classed('periodic_table', true)

        # Center the SVG within the margins. Use a <g> element
        svg.append('g')
            .attr('transform', "translate(#{ margin.left }, #{ margin.top })")

        # Used for Lanthanide and Actanide series (periods 6 and 7)
        no_group_x =
            6: 3
            7: 3

        g = svg.select('g').selectAll('g.element')
            # Set data to the given array
            # For each of these elements, append a <g> (SVG group)
            .data(elementsData).enter()
            .append('g')


            # Every <g> gets the same class
        g.attr('class', (d) -> "element #{d.sym} #{d.name}")
            # The <g>'s 'transform' is dependent on the element
            .each((d) ->
                svg_elem = d3.select this
                if d.group? # Neither a Lanthanide nor an Actanide
                    d.x = d.group * elemSize
                    d.y = d.period * elemSize
                    # Make gap for Lanthanides and Actanides
                    if d.group >= 3 then d.x += elemSize

                    # Add CSS class dependent on element's group
                    # Examples: group_1, group_2 ...
                    svg_elem.classed "group_#{ d.group }", true
                else
                    # Place in order and with a 1 row gap
                    # TODO XXX MAJOR BUG! WHAT IF UNORDERED IN DATA? XXX TODO
                    d.x = (no_group_x[d.period]++) * elemSize
                    d.y = (3 + (+d.period)) * elemSize

                    # Add CSS class nogroup
                    svg_elem.classed 'nogroup', true

                # CSS period class
                svg_elem.classed "period_#{ d.period }", true
            )
            # Translate the element according to its period + group
            .attr('transform', (d) ->
                "translate(#{ d.x - elemSize/2 },#{ d.y })
                 scale(#{ elemScale })"
            )

        defaultText = (d) ->
            d3.select(this)
            .style('fill', perceivable_inverse (color d))
        defaultColors = (d) ->
            d3.select(this)
            .style('fill', color d)
            .style('stroke', perceivable_inverse (color d))

        # Append a <rect> to every <g> or nothing gets shown
        g.append('rect')
            # Set dimensions. The (* 0.92) creates gaps between elements
            .classed('element_box', true)
            .attr('height', elemSize).attr('width', elemSize)
            .attr('x', -elemSize / 2)
            .attr('y', -elemSize / 2)
            .each(defaultColors)

        # Add <text> label to each <g>
        g.append('text')
            .classed('symbol box_info', true)
            .attr('y', 7)
            .each(defaultText)
            # Set text to d.sym
            # Examples: H, O, F, Ni, Uuo
            .text (d) -> d.sym

        g.append('text')
            .classed('box_info', true)
            .text (d) -> niceFormat d.atomicWeight
            .attr('y', 21)
            .each(defaultText)

        g.append('text')
            .classed('box_info', true)
            .attr('y', -14)
            .attr('x', 14)
            .each(defaultText)
            .text (d) -> d.atomicNumber

        draw_controls()
        if colClass
            draw_legend()

        svg.call(zoom)
        # zoom off by default
        vis.togglezoom(false)

        svg.call tip
        vis.togglehovertips(true)

        vis.heightClass(heightClass)

        vis

    # Return the SVG
    vis.svg = ->
        svg

    # Set/get the root
    vis.root = (_) ->
        if not arguments.length then return root
        root = _
        vis

    vis.classifiers = -> classifiers

    vis.togglezoom = (turnOn) ->
        if turnOn
            zoom.on('zoom', ->
                zoomed = not (d3.event.scale == 1)
                svg.select('g').attr('transform', "translate(#{ d3.event.translate })
                                                   scale(#{ d3.event.scale  })")
            )
        else
            zoom.on('zoom', null)
            svg.select('g').attr('transform', "translate(#{ margin.left }, #{ margin.top })")


    vis.togglehovertips = (turnOn) ->
        if turnOn
            g.on('mouseenter', tip.show)
             .on('mouseleave', tip.hide)
        else
            g.on('mouseenter', null)
             .on('mouseleave', null)

    colorElement = (d, e, colorFun) ->
        if d.highlighted
            return

        if not colorFun?
            colorFun = color

        if not e?
            e = svg.select("g.#{ d.sym }")
        else
            e = d3.select(e)

        e.selectAll('path.element_box, rect.element_box')
            .transition()
            .style('fill', colorFun d)
            .style('stroke', perceivable_inverse (colorFun d))

        e.selectAll('line.element_box')
             .transition()
             .style('stroke', perceivable_inverse (colorFun d))

        e.selectAll('text.box_info')
            .transition()
            .style('fill', perceivable_inverse (colorFun d))

    vis.colClass = (_) ->
        if not arguments.length then return colClass
        colClass = _

        if legend? then legend.remove()

        if colClass
            floatToColor = d3.scale.quantile()
                .domain([0,1]).range(d3.range(nCategories))
            draw_legend()

        g.each((d) -> colorElement(d, this))

        vis

    vis.heightClass = (_) ->
        if not arguments.length then return heightClass
        heightClass = _

        if not heightClass
            g.selectAll('path, line').remove()
            _height =
                path: null
                line: null

            elemScale = 1.0
            g.transition().attr('transform', (d) ->
                "translate(#{ d.x - elemSize/2 },#{ d.y })
                scale(#{ elemScale })")
        else
            elemScale = 0.7
            g.each((d) ->
                    c = classifiers[heightClass]
                    h = c.classify(c.accessor d)
                    d._heightOff = h * elemSize * Math.sqrt(2) * (1 - elemScale)
                    if not d._heightOff? or isNaN(d._heightOff)
                        d._heightOff = 0
                )
                .transition()
                .attr('transform', (d) ->
                    "translate(#{ d._heightOff/2 + d.x - elemSize/2 },
                               #{ d.y - d._heightOff/2 })
                     scale(#{ elemScale })"
                )

            if not _height.path?
                _height.path = g.insert('path', ':first-child')
                    .style('fill', (d) -> color d)
                    .style('stroke', (d) -> perceivable_inverse (color d))
                    .attr('class', 'element_box')

            if not _height.line?
                _height.line = g.insert('line', ':nth-child(2)')
                .attr('class', 'element_box')
                .style('stroke', (d) -> perceivable_inverse (color d))
                .attr('x0', 0)
                .attr('y0', 0)
                .attr('x1', 0)
                .attr('y1', 0)

            _height.path
                .transition()
                .attr('d', (d) -> "
                    M #{ -elemSize/2 } #{ -elemSize/2 }
                    l #{ -d._heightOff } #{ d._heightOff }
                    l 0 #{ elemSize }
                    l #{ elemSize } 0
                    l #{ d._heightOff } #{ -d._heightOff }
                    z"
                )

            _height.line
                .transition()
                .attr('x1', (d) -> -d._heightOff - elemSize/2)
                .attr('y1', (d) -> d._heightOff + elemSize/2)

        vis



    # Set/get the width and height
    vis.dimensions = (_) ->
        if not arguments.length then return [width, height]
        width = _[0]
        height = _[1]
        vis

    draw_legend = ->
        c = classifiers[colClass]

        y_per = 30
        rows = 3

        x_per = width / (nCategories + 1) * rows * 0.43
        cols = Math.ceil((nCategories + 1) / rows)

        # Color palette
        legend = control_container.append('svg')
            .classed('color_legend', true)
            .style('display', 'none')
            .attr('width', cols * x_per)
            .attr('height', rows * y_per * 1.1)

        legend_elem = legend.selectAll('g.color')
          .data(colorPalette.concat([
                perceivable_inverse colorPalette[nCategories - 1]] \
          )).enter()
            .append('g')
            .classed('color', true)
            .attr('transform', (d, i) -> "translate(#{ (i - i % rows) * x_per / rows }, #{ (i % rows) * y_per })")

        legend_elem.append('rect')
            .classed('element_box', true)
            .attr('width',  y_per * 0.8)
            .attr('height', y_per * 0.8)
            .style('fill', (d) -> d)
            .style('stroke', (d) -> perceivable_inverse d)

        legend_elem.append('text')
            .attr('y', y_per / 2)
            .attr('x', y_per * 0.85)
            .text((d) ->
                ex = invertExtentColor(d)
                if typeof ex == 'string'
                then "#{ ex }"
                else "#{ niceFormat(ex[0]) } - #{ niceFormat(ex[1]) }"
            )




    draw_controls = ->
        # <div> if none exists
        if not control_container?
            control_container = root.insert('div', ':first-child')
            .classed('controls', true)

        control_wrap = control_container.append('div')
            .classed('main_controls', true)

        control_wrap.append('h1')
            .text('Periodic Table')

        # Color classifier selector
        for _class in [['heightClass', 'Height'], ['colClass', 'Colors']]
            cc = control_wrap.append('p')

            cc.classed("title cell #{ _class[0] }", true)
                .text("#{ _class[1] }: ")
            _class = _class[0]

            cc.append('span')
                .append('select')
                .attr('onchange', "vis.#{ _class }(this.value)")
                .selectAll('option')
                # empty string = javascript false
                .data(Object.keys(classifiers).concat([""])).enter()
                .append('option')
                .each((d) ->
                    if d == vis[_class]() or (not vis[_class]() and not d)
                        d3.select(this).attr('selected', 'selected')
                )
                .attr('value', (d) -> d)
                .text((d) -> if d then d.split('_').join(' ') else 'none')

        _control_wrap = control_wrap.append('p')
        for x in ['zoom', 'hovertips']
            cc = _control_wrap.append('span')
            cc.append('input')
                .attr('type', 'checkbox')
                .attr('aria-labelledby', "toggle_#{ x }")
                .attr('id', "toggle_#{ x }_checkbox")
                # zoom is off by default
                .attr('checked', if x == 'zoom' then null else 'checked')
                .on('change', ((x) -> ->
                    vis["toggle#{ x }"]( d3.select(this).property('checked') )
                # scope issue fix.
                )(x) )

            cc.append('label')
                .attr('id', "toggle_#{ x }")
                .attr('for', "toggle_#{ x }_checkbox")
                .text("Toggle #{ x }")

        cc = control_wrap.append('p')

        cc.append('label')
            .attr('id', 'search_label')
            .attr('for', 'search')
            .text("Search by any property")


        cc.append('input')
            .attr('type', 'input')
            .attr('aria-labelledby', 'search_label')
            .attr('id', 'search')
            .attr('placeholder', 'Search here')
            .on('input', ->
                results = {}
                # Search every property of every element
                if this.value then for e in elementsData
                    for k, v of e
                        if (''+v).toLowerCase().indexOf(this.value.toLowerCase()) >= 0
                            results[e.name] = e

                clearHighlights()
                highlightElement v for k,v of results
            )

    vis
