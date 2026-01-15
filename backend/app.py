"""
Flask entry point for OpenQASM 3 Web Compiler & Simulator
"""
from flask import Flask, render_template, request, jsonify, Response, redirect, url_for
from compiler.executor import compile_and_simulate
from utils.errors import CompilationError, SimulationError
import traceback
import io
import base64
import os
import sys

# Handle PyInstaller paths
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    base_path = sys._MEIPASS
    template_folder = os.path.join(base_path, 'frontend', 'templates')
    static_folder = os.path.join(base_path, 'frontend', 'static')
else:
    # Running as script
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_folder = os.path.join(base_path, 'frontend', 'templates')
    static_folder = os.path.join(base_path, 'frontend', 'static')

app = Flask(__name__, 
            template_folder=template_folder,
            static_folder=static_folder)

def get_saved_dir():
    """
    Get the path to the Saved directory.
    When running as compiled executable, save files next to the .exe.
    When running as script, save files in the static/Saved folder.
    """
    if getattr(sys, 'frozen', False):
        # Running as compiled executable - save next to the .exe
        exe_dir = os.path.dirname(sys.executable)
        saved_dir = os.path.join(exe_dir, 'Saved')
    else:
        # Running as script - use the static/Saved folder
        saved_dir = os.path.join(static_folder, 'Saved')
    return saved_dir

@app.route('/')
def index():
    """Redirect root to home page"""
    return redirect(url_for('home'))

@app.route('/home')
def home():
    """Serve the home page"""
    return render_template('home.html')

@app.route('/compiler')
def compiler():
    """Serve the compiler page"""
    return render_template('compiler.html')

@app.route('/circuit-diagram', methods=['POST'])
def circuit_diagram():
    """
    Generate circuit diagram from OpenQASM 3 code
    
    Expected JSON:
    {
        "code": "..."
    }
    
    Returns:
    {
        "success": true,
        "svg": "<svg>...</svg>"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        code = data.get('code', '')
        if not code:
            return jsonify({
                "success": False,
                "error": "No code provided"
            }), 400
        
        # Parse circuit using qiskit-qasm3-import (as per https://pypi.org/project/qiskit-qasm3-import/)
        try:
            from compiler.parser import parse_qasm
            circuit = parse_qasm(code)
            
            if circuit is None:
                return jsonify({
                    "success": False,
                    "error": "OpenQASM 3 parser not available. Please install qiskit-qasm3-import."
                }), 400
            
            # Always try to bind parameters if present, else just draw circuit.
            import math
            try:
                if circuit.parameters:
                    parameter_binds = {param: math.pi / 2.0 for param in circuit.parameters}
                    circuit_bound = circuit.assign_parameters(parameter_binds)
                    text_diagram = str(circuit_bound.draw(output='text', fold=-1))
                else:
                    text_diagram = str(circuit.draw(output='text', fold=-1))
                return jsonify({
                    "success": True,
                    "text": text_diagram,
                    "format": "text"
                })
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": f"Failed to generate circuit diagram: {str(e)}"
                }), 500
        except CompilationError as e:
            return jsonify({
                "success": False,
                "error": f"Compilation error: {str(e)}"
            }), 400
        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"Failed to parse circuit: {str(e)}"
            }), 400
        
        # # Generate SVG diagram
        # try:
        #     import matplotlib
        #     matplotlib.use('Agg')  # Use non-interactive backend
        #     import matplotlib.pyplot as plt
            
        #     # Draw circuit with matplotlib - fold=-1 prevents horizontal folding (removes » and «)
        #     fig = circuit.draw(output='mpl', fold=-1, style={'backgroundcolor': '#0f0f0f', 
        #                                                       'textcolor': '#10b981',
        #                                                       'gatecolor': '#10b981'})
            
        #     # Convert to SVG
        #     img_buffer = io.BytesIO()
        #     fig.savefig(img_buffer, format='svg', bbox_inches='tight', 
        #                facecolor='#0f0f0f', edgecolor='none', transparent=True)
        #     img_buffer.seek(0)
        #     svg_data = img_buffer.read().decode('utf-8')
        #     plt.close(fig)
            
        #     return jsonify({
        #         "success": True,
        #         "svg": svg_data
        #     })
        # except Exception as e:
            # Fallback to text representation
            try:
                # Use str() to convert TextDrawing to string - fold=-1 prevents horizontal folding
                text_diagram = str(circuit.draw(output='text', fold=-1))
                return jsonify({
                    "success": True,
                    "text": text_diagram,
                    "format": "text"
                })
            except Exception as e2:
                return jsonify({
                    "success": False,
                    "error": f"Failed to generate diagram: {str(e2)}"
                }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/download-circuit', methods=['POST'])
def download_circuit():
    """
    Download circuit diagram as PNG using matplotlib
    
    Expected JSON:
    {
        "code": "..."
    }
    
    Returns:
    PNG image file
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        code = data.get('code', '')
        if not code:
            return jsonify({
                "success": False,
                "error": "No code provided"
            }), 400
        
        # Parse circuit using qiskit-qasm3-import
        try:
            from compiler.parser import parse_qasm
            circuit = parse_qasm(code)
            
            if circuit is None:
                return jsonify({
                    "success": False,
                    "error": "OpenQASM 3 parser not available. Please install qiskit-qasm3-import."
                }), 400
            
            # Bind parameters if circuit has input parameters
            if circuit.parameters:
                import math
                parameter_binds = {}
                for param in circuit.parameters:
                    parameter_binds[param] = math.pi / 2.0
                circuit = circuit.assign_parameters(parameter_binds)
        except CompilationError as e:
            return jsonify({
                "success": False,
                "error": f"Compilation error: {str(e)}"
            }), 400
        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"Failed to parse circuit: {str(e)}"
            }), 400
        
        # Generate PNG using matplotlib
        try:
            import matplotlib
            matplotlib.use('Agg')  # Use non-interactive backend
            import matplotlib.pyplot as plt
            
            # Draw circuit with matplotlib - fold=-1 prevents horizontal folding
            fig = circuit.draw(output='mpl', fold=-1)
            
            # Save to BytesIO buffer as PNG, use a lower DPI to speed up for big circuits
            img_buffer = io.BytesIO()
            try:
                # Lower dpi and less tight bbox for speed
                fig.savefig(
                    img_buffer,
                    format='png',
                    bbox_inches='tight',
                    facecolor='white',
                    edgecolor='none',
                    dpi=70,  # Lower DPI for faster rendering (default=100, was 150)
                    pad_inches=0.05  # Slightly less whitespace for speed
                )
            finally:
                plt.close(fig)
            img_buffer.seek(0)
            
            # Return PNG file
            return Response(
                img_buffer.getvalue(),
                mimetype='image/png',
                headers={
                    'Content-Disposition': 'attachment; filename=circuit.png'
                }
            )
        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"Failed to generate PNG: {str(e)}"
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/saved-files', methods=['GET'])
def get_saved_files():
    """
    Get list of .qasm files in the Saved folder
    """
    try:
        saved_dir = get_saved_dir()
        files = []
        
        if os.path.exists(saved_dir):
            for filename in os.listdir(saved_dir):
                if filename.endswith('.qasm') or filename.endswith('.qasm3'):
                    # Get file name without extension for display
                    name = os.path.splitext(filename)[0]
                    files.append({
                        'filename': filename,
                        'name': name.replace('_', ' ').title()
                    })
        
        return jsonify({
            "success": True,
            "files": sorted(files, key=lambda x: x['name'])
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/save-file', methods=['POST'])
def save_file():
    """
    Save OpenQASM 3 code to a file in the Saved folder
    
    Expected JSON:
    {
        "filename": "example.qasm",
        "code": "..."
    }
    
    Returns:
    {
        "success": true,
        "message": "File saved successfully"
    }
    """
    try:
        import os
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        filename = data.get('filename', '').strip()
        code = data.get('code', '')
        
        if not filename:
            return jsonify({
                "success": False,
                "error": "No filename provided"
            }), 400
        
        if not code:
            return jsonify({
                "success": False,
                "error": "No code provided"
            }), 400
        
        # Ensure filename ends with .qasm
        if not filename.endswith('.qasm') and not filename.endswith('.qasm3'):
            filename += '.qasm'
        
        # Sanitize filename (remove path traversal attempts)
        filename = os.path.basename(filename)
        if not filename or filename in ['.', '..']:
            return jsonify({
                "success": False,
                "error": "Invalid filename"
            }), 400
        
        # Get the Saved directory path
        saved_dir = get_saved_dir()
        os.makedirs(saved_dir, exist_ok=True)
        
        # Full file path
        file_path = os.path.join(saved_dir, filename)
        
        # Write the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)
        
        return jsonify({
            "success": True,
            "message": f"File '{filename}' saved successfully"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to save file: {str(e)}"
        }), 500

@app.route('/check-file-exists', methods=['POST'])
def check_file_exists():
    """
    Check if a file exists in the Saved folder
    
    Expected JSON:
    {
        "filename": "example.qasm"
    }
    
    Returns:
    {
        "exists": true/false
    }
    """
    try:
        import os
        data = request.get_json()
        if not data:
            return jsonify({
                "exists": False
            }), 400
        
        filename = data.get('filename', '').strip()
        if not filename:
            return jsonify({
                "exists": False
            }), 400
        
        # Ensure filename ends with .qasm
        if not filename.endswith('.qasm') and not filename.endswith('.qasm3'):
            filename += '.qasm'
        
        # Sanitize filename
        filename = os.path.basename(filename)
        
        # Get the Saved directory path
        saved_dir = get_saved_dir()
        file_path = os.path.join(saved_dir, filename)
        
        exists = os.path.exists(file_path)
        
        return jsonify({
            "exists": exists
        })
        
    except Exception as e:
        return jsonify({
            "exists": False
        }), 500

@app.route('/delete-file', methods=['POST'])
def delete_file():
    """
    Delete a file from the Saved folder
    
    Expected JSON:
    {
        "filename": "example.qasm"
    }
    
    Returns:
    {
        "success": true,
        "message": "File deleted successfully"
    }
    """
    try:
        import os
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        filename = data.get('filename', '').strip()
        if not filename:
            return jsonify({
                "success": False,
                "error": "No filename provided"
            }), 400
        
        # Sanitize filename
        filename = os.path.basename(filename)
        if not filename or filename in ['.', '..']:
            return jsonify({
                "success": False,
                "error": "Invalid filename"
            }), 400
        
        # Get the Saved directory path
        saved_dir = get_saved_dir()
        file_path = os.path.join(saved_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                "success": False,
                "error": "File not found"
            }), 404
        
        # Delete the file
        os.remove(file_path)
        
        return jsonify({
            "success": True,
            "message": f"File '{filename}' deleted successfully"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to delete file: {str(e)}"
        }), 500

@app.route('/rename-file', methods=['POST'])
def rename_file():
    """
    Rename a file in the Saved folder
    
    Expected JSON:
    {
        "oldFilename": "example.qasm",
        "newFilename": "newname"
    }
    
    Returns:
    {
        "success": true,
        "message": "File renamed successfully"
    }
    """
    try:
        import os
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        oldFilename = data.get('oldFilename', '').strip()
        newFilename = data.get('newFilename', '').strip()
        
        if not oldFilename or not newFilename:
            return jsonify({
                "success": False,
                "error": "Both old and new filenames are required"
            }), 400
        
        # Ensure new filename ends with .qasm
        if not newFilename.endswith('.qasm') and not newFilename.endswith('.qasm3'):
            newFilename += '.qasm'
        
        # Sanitize filenames
        oldFilename = os.path.basename(oldFilename)
        newFilename = os.path.basename(newFilename)
        
        if not oldFilename or oldFilename in ['.', '..'] or not newFilename or newFilename in ['.', '..']:
            return jsonify({
                "success": False,
                "error": "Invalid filename"
            }), 400
        
        # Get the Saved directory path
        saved_dir = get_saved_dir()
        old_path = os.path.join(saved_dir, oldFilename)
        new_path = os.path.join(saved_dir, newFilename)
        
        if not os.path.exists(old_path):
            return jsonify({
                "success": False,
                "error": "File not found"
            }), 404
        
        if os.path.exists(new_path):
            return jsonify({
                "success": False,
                "error": "A file with the new name already exists"
            }), 400
        
        # Rename the file
        os.rename(old_path, new_path)
        
        return jsonify({
            "success": True,
            "message": f"File renamed from '{oldFilename}' to '{newFilename}' successfully"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to rename file: {str(e)}"
        }), 500

@app.route('/compile', methods=['POST'])
def compile():
    """
    Compile and simulate OpenQASM 3 code
    
    Expected JSON:
    {
        "code": "...",
        "shots": 1024
    }
    
    Returns:
    {
        "success": true,
        "qubits": 3,
        "shots": 1024,
        "counts": {"000": 512, "111": 512}
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        code = data.get('code', '')
        shots = data.get('shots', 1024)
        
        if not code:
            return jsonify({
                "success": False,
                "error": "No code provided"
            }), 400
        
        # Compile and simulate
        result = compile_and_simulate(code, shots)
        
        return jsonify({
            "success": True,
            **result
        })
        
    except CompilationError as e:
        return jsonify({
            "success": False,
            "error": f"Compilation error: {str(e)}"
        }), 400
        
    except SimulationError as e:
        return jsonify({
            "success": False,
            "error": f"Simulation error: {str(e)}"
        }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "traceback": traceback.format_exc()
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5010)
