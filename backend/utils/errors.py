"""
Custom exception classes for compilation and simulation errors
"""

class CompilationError(Exception):
    """Raised when OpenQASM 3 code fails to parse or validate"""
    pass

class SimulationError(Exception):
    """Raised when quantum simulation fails"""
    pass
