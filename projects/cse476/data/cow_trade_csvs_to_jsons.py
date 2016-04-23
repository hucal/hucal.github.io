import sys
import csv
import json


def csv_to(converter, fname, directory):
    """
    Takes a location to a CSV file and a directory name (pre-existing).
    Groups CSV rows by 'SPLIT_IX' and writes each of these groups to a new
    CSV file in 'directory'. Row groups should be independent.
    """
    SPLIT_IX = 2 # column by which to split CSV into multiple CSV files
    csvs = {}
    header = ''
    with open(fname, 'rU') as f:
        csvreader = csv.reader(f)
        header = csvreader.next()
        for row in csvreader:
            if csvs.get(row[SPLIT_IX]) is None:
                csvs[row[SPLIT_IX]] = [row]
            else:
                csvs[row[SPLIT_IX]].append(row)

    # write_csvs(csvs, header, fname, directory)
    converter(csvs, header, fname, directory)

def json_converter(csvs, header, fname, directory):
    """
    Every group of rows is treated as a graph
    Graph nodes are identified by 'node_id', this columnn is used as a key
    in the creation of the 'node_dict' dictionary. Values include all rows
    identified by 'node_id'
    """
    to_ix = lambda l: map(lambda x: header.index(x), l)
    # prepare indices
    id_ = 'ccode1'
    id_ix = header.index('ccode1')
    alt_id = ['importer1']
    alt_id_ix = to_ix(alt_id)
    sum_columns = ['flow1', 'flow2']
    sum_columns_ix = to_ix(sum_columns)
    ignore = to_ix(['year', 'version',
            'china_alt_flow1', 'china_alt_flow2', 'bel_lux_alt_flow1',
            'bel_lux_alt_flow2'])
    to_float = ['flow1', 'flow2']
    to_float_ix = to_ix(to_float)

    to_int = ['ccode1', 'ccode2', 'source1', 'source2']
    to_int_ix = to_ix(to_int)

    # for every year
    for ix in csvs:
        node_dict = {}
        # every row
        for row in csvs[ix]:
            obj = {}

            # convert row to python object
            for i in range(len(header)):
                if i not in ignore and i not in alt_id_ix:
                    if i in to_float_ix:
                        obj[header[i]] = row[i] = float(row[i])
                    elif i in to_int_ix:
                        obj[header[i]] = row[i] = int(float(row[i])) # bug with "710."
                    else:
                        obj[header[i]] = row[i]

            # new node based on id_ix
            if node_dict.get(row[id_ix]) is None:
                node = { 'links': [obj] }

                # copy node IDs
                for (i, id_) in zip(alt_id_ix, alt_id):
                    node[id_] = row[i]

                node_dict[row[id_ix]] = node
                # take sum of sum_columns
                for s in sum_columns:
                    node[s + '_total'] = obj[s] if obj[s] > 0 else 0
            # or append to existing node
            else:
                node = node_dict[row[id_ix]]
                node['links'].append(obj)
                # take sum of sum_columns
                for s in sum_columns:
                    node[s + '_total'] += obj[s] if obj[s] > 0 else 0

        # prepare for JSON serialization
        json_data = {'nodes': [], 'links': [], 'year': int(float(ix))}

        # write nodes to the json object
        for node_key in node_dict:
            obj = {
                'ccode': node_key,
                'name': node_dict[node_key]['importer1'],
                'links': node_dict[node_key]['links']
            }
            for col in sum_columns:
                obj[col + '_total'] = node_dict[node_key][col + '_total']
            json_data['nodes'].append(obj)

        # sort nodes on dict key 'ccode'
        def get_ccode(obj):
            return obj['ccode']

        nodes_len = len(json_data['nodes'])
        json_data['nodes'].sort(key=get_ccode)

        def binary_s(ccode):
            min = 0
            max = nodes_len - 1
            while True:
                if max < min:
                    # print "COUNTRY CODE NOT FOUND", ccode
                    return -1

                ix = (min + max) // 2
                if json_data['nodes'][ix]['ccode'] < ccode:
                    min = ix + 1
                elif json_data['nodes'][ix]['ccode'] > ccode:
                    max = ix - 1
                else:
                    return ix



        # create links array (based on node indices in nodes array) for D3
        for obj_ix in range(nodes_len):
            obj = json_data['nodes'][obj_ix]
            for link in obj['links']:
                if float(link['flow1']) < 0:
                    continue
                other_ix = binary_s(link['ccode2'])
                if other_ix < 0:
                    continue

                json_data['links'].append({
                    'source': obj_ix,
                    'target': other_ix
                    })


        fname = directory + '/' + ix + '.json'
        print 'writing file', fname
        with open(fname, 'w') as new_json:
            # serialize in compact format
            new_json.write(json.dumps(json_data, separators=(',', ':')))  # , indent=0))


def csvs_converter(csvs, header, fname, directory):
    for ix in csvs:
        with open(directory + '/' + ix + '.csv', 'w') as new_csv:
            for row in [header] + csvs[ix]:
                new_csv.write(','.join(row) + '\n')


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit('Usage: %s cow_trade_csv_file output_directory'
        % sys.argv[0])

    csv_to(json_converter, sys.argv[1], sys.argv[2])
