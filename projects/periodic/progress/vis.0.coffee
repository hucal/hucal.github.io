# The document has finished loading (but not its dependent resources).
d3.select(document).on 'DOMContentLoaded', ->
    # Request JSON to be loaded and write the callback
    d3.json 'table.json', (error, elements) ->
        console.log elements
        return
    return
