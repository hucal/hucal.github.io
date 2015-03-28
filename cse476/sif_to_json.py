import sys
import json

def sif_to_json(fname, output):
    """
    """
    json_data = {'nodes': [], 'links': []}
    with open(fname) as f:
        for line in f.readlines():
            caller, callee = map(lambda s: s.rstrip(), line.split(' call '))
            json_data['links'].append({'source': caller, 'target': callee})
            if not caller in json_data['nodes']:
                json_data['nodes'].append(caller)
            if not callee in json_data['nodes']:
                json_data['nodes'].append(callee)
    print 'writing file', fname
    with open(output, 'w') as new_json:
        new_json.write(json.dumps(json_data, sort_keys=True,
                  indent=4, separators=(',', ': ')))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit('Usage: %s file.sif output.json'
        % sys.argv[0])

    sif_to_json(sys.argv[1], sys.argv[2])
