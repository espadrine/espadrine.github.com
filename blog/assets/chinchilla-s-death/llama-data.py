import csv

llama = {}
versions = ['1', '2']
llama_models = {
    '1': ['7B', '13B', '33B', '65B'],
    '2': ['7B', '13B', '34B', '70B']
}
llama_gpu_hours = {
    '1': {
        '7B':    82432,
        '13B':  135168,
        '33B':  530432,
        '65B': 1022362,
    },
    '2': {
        '7B':   184320,
        '13B':  368640,
        '34B': 1038336,
        '70B': 1720320,
    }
}

for version in versions:
    llama[version] = {}
    for model in llama_models[version]:
        llama[version][model] = {}
        # Extracted with `mutool show llama.pdf 108`.
        with open(f"./data/llama{version}-{model}-pixels.tsv", 'r') as f:
            reader = csv.reader(f, delimiter='\t')
            pixels = []
            for row in reader:
                pixels.append([float(row[0]), float(row[1])])
            llama[version][model]['pixels'] = pixels
            llama[version][model]['gpu_hours'] = llama_gpu_hours[version][model]

# Pixel conversion.
for version in versions:
    for model in llama_models[version]:
        llama[version][model]['x_pixels'] = [pixel[0] for pixel in llama[version][model]['pixels']]
        llama[version][model]['y_pixels'] = [pixel[1] for pixel in llama[version][model]['pixels']]

# Value = A * pixel + B
# => A = (last_value - first_value) / (last_pixel - first_pixel)
#    B = last_value - A * last_pixel
def linear_coeffs(series, first_value, last_value):
    a = (last_value - first_value) / (series[-1] - series[0])
    b = last_value - a * series[-1]
    return [a, b]

# We use https://apps.automeris.io/wpd/ to estimate the first and last points of the 65B model.
# Since the first data dot does not appear on the graph, we adjust the Y value
# to have the end of the 7B training run match.
llama_plot_coeffs = {
    '1': {
        'x': linear_coeffs(llama['1']['65B']['x_pixels'], 100, 2000),
        'y': linear_coeffs(llama['1']['65B']['y_pixels'], 2.25, 1.5572327044025158),
    },
    '2': {
        'x': linear_coeffs(llama['2']['70B']['x_pixels'], 14.77104874446087, 2000.0),
        'y': linear_coeffs(llama['2']['70B']['y_pixels'], 2.39, 1.4957264957264955),
    }
}

# Conversion functions.
def llama_gtoken_from_x_pixel(pixel, version):
    return pixel * llama_plot_coeffs[version]['x'][0] + llama_plot_coeffs[version]['x'][1]

def llama_loss_from_y_pixel(pixel, version):
    return pixel * llama_plot_coeffs[version]['y'][0] + llama_plot_coeffs[version]['y'][1]

for version in versions:
    for model in llama_models[version]:
        llama[version][model]['gtokens'] = [llama_gtoken_from_x_pixel(x, version) for x in llama[version][model]['x_pixels']]
        llama[version][model]['loss'] = [llama_loss_from_y_pixel(x, version) for x in llama[version][model]['y_pixels']]
print("First point:", llama['1']['7B']['gtokens'][0], "gigatokens with loss", llama['1']['7B']['loss'][0])

# Time conversion.
def gpu_hour_per_gtoken(version, model):
    return llama[version][model]['gpu_hours'] / llama[version][model]['gtokens'][-1]

for version in versions:
    for model in llama_models[version]:
        hpgt = gpu_hour_per_gtoken(version, model)
        print(f"Version {version} model {model} cruises at {1e9/hpgt/3600} tokens/second")
        llama[version][model]['gpu_hour_per_gtoken'] = hpgt
        llama[version][model]['hours'] = [gtokens * hpgt for gtokens in llama[version][model]['gtokens']]
print("First point:", llama['1']['7B']['hours'][0], "hours for", llama['1']['7B']['gtokens'][0], "gtokens (", llama['1']['7B']['gpu_hour_per_gtoken'], "hour/gtoken )")

# Write result.
for version in versions:
    for model in llama_models[version]:
        with open(f"./data/llama{version}-{model}.tsv", "w") as f:
            writer = csv.writer(f, delimiter="\t")
            writer.writerow(["Hours", "Loss"])
            data = [[llama[version][model]['hours'][i],
                     llama[version][model]['loss'][i]]
                for i in range(len(llama[version][model]['hours']))]
            writer.writerows(data)
