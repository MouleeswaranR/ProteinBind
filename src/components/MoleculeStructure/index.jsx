"use client";
import React, { Component } from "react";
import _ from "lodash";
import PropTypes from "prop-types";

const initRDKit = (() => {
  let rdkitLoadingPromise;
  return () => {
    if (!rdkitLoadingPromise) {
      rdkitLoadingPromise = new Promise((resolve, reject) => {
        // Check if RDKit is already on the window (from the script tag)
        if (window.initRDKitModule) {
          window.initRDKitModule()
            .then((RDKit) => {
              resolve(RDKit);
            })
            .catch((e) => {
              reject(e);
            });
        } else {
            // Fallback to npm package if script tag fails
            import("@rdkit/rdkit")
                .then((module) => {
                    const initRDKitModule = module.default;
                    return initRDKitModule();
                })
                .then((RDKit) => {
                    resolve(RDKit);
                })
                .catch(reject);
        }
      });
    }
    return rdkitLoadingPromise;
  };
})();

class MoleculeStructure extends Component {
  static propTypes = {
    id: PropTypes.string.isRequired,
    className: PropTypes.string,
    svgMode: PropTypes.bool,
    width: PropTypes.number,
    height: PropTypes.number,
    structure: PropTypes.string.isRequired,
    subStructure: PropTypes.string,
    extraDetails: PropTypes.object,
    drawingDelay: PropTypes.number,
    scores: PropTypes.number,
  };

  static defaultProps = {
    subStructure: "",
    className: "",
    width: 250,
    height: 200,
    svgMode: false,
    extraDetails: {},
    drawingDelay: undefined,
    scores: 0,
  };

  constructor(props) {
    super(props);

    this.MOL_DETAILS = {
      width: this.props.width,
      height: this.props.height,
      bondLineWidth: 1,
      addStereoAnnotation: true,
      ...this.props.extraDetails,
    };

    this.state = {
      svg: undefined,
      rdKitLoaded: false,
      rdKitError: false,
    };
  }

  drawOnce = (() => {
    let wasCalled = false;

    return () => {
      if (!wasCalled) {
        wasCalled = true;
        this.draw();
      }
    };
  })();

  draw() {
    if (this.props.drawingDelay) {
      setTimeout(() => {
        this.drawSVGorCanvas();
      }, this.props.drawingDelay);
    } else {
      this.drawSVGorCanvas();
    }
  }

  drawSVGorCanvas() {
    if (!this.RDKit || !this.props.structure || this.props.structure === "Unknown") return;
    
    try {
        const mol = this.RDKit.get_mol(this.props.structure);
        if (!mol) return;
        
        const qmol = this.RDKit.get_qmol(this.props.subStructure || "invalid");
        const isValidMol = this.isValidMol(mol);

        if (this.props.svgMode && isValidMol) {
            const svg = mol.get_svg_with_highlights(this.getMolDetails(mol, qmol));
            this.setState({ svg });
        } else if (isValidMol) {
            const canvas = document.getElementById(this.props.id);
            if (canvas) {
                mol.draw_to_canvas_with_highlights(canvas, this.getMolDetails(mol, qmol));
            }
        }

        mol?.delete();
        qmol?.delete();
    } catch (e) {
        console.error("Error drawing molecule:", e);
    }
  }

  isValidMol(mol) {
    return !!mol;
  }

  getMolDetails(mol, qmol) {
    if (this.isValidMol(mol) && this.isValidMol(qmol)) {
      const subStructHighlightDetails = JSON.parse(
        mol.get_substruct_matches(qmol),
      );
      const subStructHighlightDetailsMerged = !_.isEmpty(
        subStructHighlightDetails,
      )
        ? subStructHighlightDetails.reduce(
            (acc, { atoms, bonds }) => ({
              atoms: [...acc.atoms, ...atoms],
              bonds: [...acc.bonds, ...bonds],
            }),
            { bonds: [], atoms: [] },
          )
        : subStructHighlightDetails;
      return JSON.stringify({
        ...this.MOL_DETAILS,
        ...(this.props.extraDetails || {}),
        ...subStructHighlightDetailsMerged,
      });
    } else {
      return JSON.stringify({
        ...this.MOL_DETAILS,
        ...(this.props.extraDetails || {}),
      });
    }
  }

  componentDidMount() {
    initRDKit()
      .then((RDKit) => {
        this.RDKit = RDKit;
        this.setState({ rdKitLoaded: true });
        try {
          this.draw();
        } catch (err) {
          console.log(err);
        }
      })
      .catch((err) => {
        console.error("RDKit load error:", err);
        this.setState({ rdKitError: true });
      });
  }

  componentDidUpdate(prevProps) {
    if (this.state.rdKitLoaded) {
      const shouldUpdateDrawing =
        prevProps.structure !== this.props.structure ||
        prevProps.svgMode !== this.props.svgMode ||
        prevProps.subStructure !== this.props.subStructure ||
        prevProps.width !== this.props.width ||
        prevProps.height !== this.props.height ||
        !_.isEqual(prevProps.extraDetails, this.props.extraDetails);

      if (shouldUpdateDrawing) {
        this.draw();
      }
    }
  }

  render() {
    if (this.state.rdKitError) {
      return (
        <div className="text-red-500 text-xs">
          Renderer Error
        </div>
      );
    }
    if (!this.state.rdKitLoaded) {
      return (
        <div className="text-gray-400 text-xs animate-pulse">
          Loading...
        </div>
      );
    }

    if (!this.props.structure || this.props.structure === "Unknown") {
        return <span className="text-gray-400 text-xs italic">No Data</span>;
    }

    let mol;
    try {
        mol = this.RDKit.get_mol(this.props.structure);
    } catch (e) {
        mol = null;
    }
    
    const isValidMol = this.isValidMol(mol);
    mol?.delete();

    if (!isValidMol) {
      return (
        <div className="flex flex-col items-center">
            <img 
                src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(this.props.structure)}/PNG`} 
                alt="molecule"
                className="max-w-full h-auto rounded shadow-sm border border-stroke dark:border-strokedark"
                style={{ width: this.props.width, height: this.props.height, objectFit: 'contain' }}
                onError={(e) => {
                    const target = e.target;
                    target.style.display = 'none';
                    target.nextSibling.style.display = 'block';
                }}
            />
            <span className="text-orange-500 text-[10px] mt-1 hidden">Structure Error</span>
        </div>
      );
    } else if (this.props.svgMode) {
      return (
        <div
          title={this.props.structure}
          className={"molecule-structure-svg " + (this.props.className || "")}
          style={{ width: this.props.width, height: this.props.height }}
          dangerouslySetInnerHTML={{ __html: this.state.svg }}
        ></div>
      );
    } else {
      return (
        <div
          className={
            "molecule-canvas-container flex flex-col items-center " + (this.props.className || "")
          }
        >
          <canvas
            title={this.props.structure}
            id={this.props.id}
            width={this.props.width}
            height={this.props.height}
            className="max-w-full h-auto"
          ></canvas>
          {this.props.scores ? (
            <p className="text-[10px] font-semibold text-primary mt-1">
              Score: {this.props.scores.toFixed(2)}
            </p>
          ) : null}
        </div>
      );
    }
  }
}

export default MoleculeStructure;
