# Call d3.json once the
# "document has finished loading (but not its dependent resources)"
d3.select(document).on 'DOMContentLoaded', ->
    # Request JSON to be loaded and write the callback
    d3.json 'table.json', (error, elements) ->
        # Print them
        console.log elements
        vis = mk_periodic_table()
        vis.root d3.select ('body')
        vis elements
        return
    return

mk_periodic_table = ->
    # Private variables
    svg = undefined
    root = undefined
    layout = undefined
    tip = undefined

    # Sane defaults
    height = 700
    width = Math.round(height * (1 + Math.sqrt(5)) / 2)
    margin =
        top: height/9
        left: width/9

    # Set data and draw the visualization
    vis = (elementsData) ->
        # Append a new SVG
        svg = root.append 'svg'
            # Set dimensions
            .attr('width', width)
            .attr('height', height)
            # Add class
            .classed('periodic_table', true)
            .append('g')
            .attr('transform', "translate(#{ margin.left }, #{ margin.top })"

        # Space needed: 10 down, 19 right
        elemSize = Math.min (height - 2 * margin.top)/ 10,
                            (width  - 2 * margin.left)/ 19)

        # Used for Lanthanide and Actanide series (periods 6 and 7)
        no_group_x =
            6: 3
            7: 3

        g = svg.selectAll('g')
            # Set data to the given array
            # For each of these elements, append a <g> (SVG group)
            .data(elementsData).enter()
            .append('g')
            # Every <g> gets the same class
            .classed('element', true)
            # The <g>'s 'transform' is dependent on the element
            .attr('transform', (d) ->
                svg_elem = d3.select this
                if d.group? # A Lanthanide or Actanide
                    x = d.group * elemSize
                    y = d.period * elemSize
                    # Make gap for Lanthanides and Actanides
                    if d.group >= 3 then x += elemSize

                    # Add CSS class dependent on element's group
                    # Examples: group_1, group_2 ...
                    svg_elem.classed "group_#{ d.group }", true
                else
                    x = (no_group_x[d.period]++) * elemSize
                    y = (3 + (+d.period)) * elemSize

                    # Add CSS class nogroup
                    svg_elem.classed 'nogroup', true

                # CSS period class
                svg_elem.classed "period_#{ d.period }", true

                # Translate the element according to its period + group
                "translate(#{ x - elemSize/2 },#{ y })"
            )

        # Append a <rect> to every <g> or nothing gets shown
        g.append('rect')
            # Set dimensions. The (* 0.92) creates gaps between elements
            .attr('height', elemSize * 0.92).attr('width', elemSize * 0.92)
            .attr('x', -elemSize / 2)
            .attr('y', -elemSize / 2)

        # Add <text> label to each <g>
        g.append('text')
            .classed('symbol', true)
            # Magic alignment
            .attr('x', -elemSize/7)
            .attr('y', elemSize/12)
            # Set text to d.sym
            # Examples: H, O, F, Ni, Uuo
            .text (d) -> d.sym

        # Prepare and activate d3.tip tooltips
        tip = d3.tip()
            .attr('class', 'd3-tip')
            .html((d) ->
                "<strong>#{d.name} (#{ d.sym })</strong>
                <p>Weight: #{ d.atomicWeight }</p>
                <p>Boiling point (K): #{ d.boilingPoint }</p>
                "
            )
        svg.call tip
        g.on('mouseenter', tip.show)
         .on('mouseleave', tip.hide)

        vis

    # Return the SVG
    vis.svg = ->
        svg

    # Set/get the root
    vis.root = (_) ->
        if not arguments[0]? then return root
        root = _
        vis

    # Set/get the width and height
    vis.dimensions = (_) ->
        if not arguments[0]? then return [width, height]
        width = _[0]
        height = _[1]
        vis

    vis
