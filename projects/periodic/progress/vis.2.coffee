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

    # Sane defaults
    height = 700
    width = Math.round(height * (1 + Math.sqrt(5)) / 2)

    # Set data and draw the visualization
    vis = (elementsData) ->
        # Append a new SVG
        svg = root.append('svg')
            # Set dimensions
            .attr('width', width)
            .attr('height', height)
            # Add class
            .classed('periodic_table', true)

        elemSize = 40

        g = svg.selectAll('g')
            # Set data to the given array
            # For each of these elements, append a <g> (SVG group)
            .data(elementsData).enter()
            .append('g')
            # Every <g> gets the same class
            .classed('element', true)
            # The <g>'s 'transform' is dependent on the element
            .attr('transform', (d, i) ->
                x = d.group * elemSize
                y = d.period * elemSize
                # Translate the element according to its period + group
                "translate(#{ x },#{ y })"
            )

        # Append a <rect> to every <g> or nothing gets shown
        g.append('rect')
            .attr('height', elemSize).attr('width', elemSize)

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
