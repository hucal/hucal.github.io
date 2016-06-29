# Call d3.json once the
# "document has finished loading (but not its dependent resources)"
d3.select(document).on 'DOMContentLoaded', ->
    # Request JSON to be loaded and write the callback
    d3.json 'table.json', (error, elements) ->
        # Print them
        console.log elements
        vis = mk_periodic_table()
        vis.root d3.select ('body')
        return
    return

mk_periodic_table = ->
    # Private variables
    svg = undefined
    root = undefined
    layout = undefined
    data = undefined

    # Sane defaults
    height = 700
    width = Math.round(height * (1 + Math.sqrt(5)) / 2)

    # Set data
    vis = (elementsData) ->
        data = elementsData
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
