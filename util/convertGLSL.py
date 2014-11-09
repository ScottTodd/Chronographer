import os
import fnmatch

# Converts shaders (.glsl files) into javascript files with exported strings.

# ANSI escape sequences for colors (makes console output pretty).
HEADER = '\033[95m'
OKBLUE = '\033[94m'
OKGREEN = '\033[92m'
WARNING = '\033[93m'
FAIL = '\033[91m'
ENDC = '\033[0m'

print "\nRunning convertGLSL.py."

matches = []
for root, dirnames, filenames in os.walk('src/js'):
    for filename in fnmatch.filter(filenames, '*.glsl'):
        matches.append(os.path.join(root, filename))

for match in matches:
    input_file_name = match
    shader_name = os.path.splitext(os.path.basename(input_file_name))[0]
    output_file_name = input_file_name.replace('.glsl', '.js')

    print HEADER + '  converting ' + ENDC + 'shader named ' + shader_name

    with open(input_file_name, 'r') as input_file:
        print OKBLUE + '    opened ' + ENDC + input_file_name + ' as input'

        with open(output_file_name, 'w') as output_file:
            print OKBLUE + '    opened ' + ENDC + output_file_name + ' as output'

            output_file.write('\'use strict\';\n\n');
            output_file.write('var ' + shader_name + ' = \'\' +\n')

            for line in input_file:
                line = line.rstrip('\n')
                output_file.write('    \'' + line + ' \\n\' +\n')

            output_file.write('    \'\';\n\n')

            output_file.write('module.exports = ' + shader_name + ';\n')

print 'GLSL to JS conversion complete!\n'
