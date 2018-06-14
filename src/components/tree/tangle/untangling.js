import { setYValuesRecursively, setYValues } from "../phyloTree/helpers";


/** calculatePearsonCorrelationCoefficient
 * "a measure of the linear correlation between two variables X and Y"
 * covariance / (stdev(tree1) * stdev(tree2))
 * @param {obj} phylotree1 Left tree
 * @param {obj} phylotree2 Right tree
 * @return {float} tangle score
 */
const calculatePearsonCorrelationCoefficient = (phylotree1, phylotree2) => {
  let count=0, my1=0, my2=0, sqy1=0, sqy2=0, y12=0;
  for (let i=0; i<phylotree2.nodes.length; i++) {
    const n2=phylotree2.nodes[i].n;
    if ((!n2.children) && phylotree1.strainToNode[n2.strain]) {
      const y1 = phylotree1.strainToNode[n2.strain].n.yvalue;
      const y2 = n2.yvalue;
      count++;
      my1+=y1;
      my2+=y2;
      sqy1+=y1**2;
      sqy2+=y2**2;
      y12 += y1*y2;
    }
  }
  my1/=count;
  my2/=count;
  sqy1/=count;
  sqy2/=count;
  y12/=count;
  const corr = (y12-my1*my2)/Math.sqrt((sqy1 - my1**2)*(sqy2 - my2**2));
  return corr;
};


/** flipChildrenPostorder
 * re-order the children - if the correlation is improved, keep the flip, else restore original
 */
const flipChildrenPostorder = (phylotree1, phylotree2) => {
  let correlation = calculatePearsonCorrelationCoefficient(phylotree1, phylotree2);
  for (let i=0; i<phylotree2.nodes.length; i++) {
    const phyloNode = phylotree2.nodes[i];
    const reduxNode = phyloNode.n;
    if (phyloNode.children && phyloNode.leafCount < 250) {

      /* step 1: find the left-most y value descendent from this node.
      This is needed to recursively set new y-values downstream of this node
      instead of setting them for everything. */

      let leftMostNode = reduxNode;
      while (leftMostNode.hasChildren) {
        let nodeWithSmallestY = leftMostNode.children[0];
        leftMostNode.children.forEach((node) => {
          if (node.yvalue < nodeWithSmallestY.yvalue) {
            nodeWithSmallestY = node;
          }
        });
        leftMostNode = nodeWithSmallestY;
      }
      const originalStartingY = leftMostNode.yvalue - 1; // setYValuesRecursively expects the previous Y value

      if (phyloNode.children.length <= 2) {
        // console.log("bifurcation")
        /* step 2: reverse the children, recalc the y-values, and see if things improved */
        phyloNode.children.reverse();
        // if (phyloNode.children.length > 2) {console.log(phyloNode.children.length);}
        // reduxNode.children.reverse();
        setYValuesRecursively(phyloNode, originalStartingY);
        const new_corr = calculatePearsonCorrelationCoefficient(phylotree1, phylotree2);
        if (correlation > new_corr) {
          phyloNode.children.reverse();
          // reduxNode.children.reverse();
          setYValuesRecursively(phyloNode, originalStartingY);
          // setYValuesRecursively(phylotree2.nodes[0], 0);
        } else {
          correlation = new_corr;
        }
      } else {
        // console.log(phyloNode.children.length)
        // loop over all children
        for (let ii = 0; ii < phyloNode.children.length-1; ii++) {

          let bestChildren = [...phyloNode.children];
          const oldChildren = [...phyloNode.children];
          // try all the ones downstream of the outer loop
          // console.log(phyloNode.children.length, bestChildren.length )
          let innerCorr = 0;
          for (let j = ii; j < oldChildren.length; j++) {

            const newChildren = [];
            for (let k=0; k<ii; k++) {
              newChildren.push(oldChildren[k]);
            }
            newChildren.push(oldChildren[j]);
            for (let k=ii; k<oldChildren.length; k++) {
              if (k !== j) newChildren.push(oldChildren[k]);
            }

            // must set to calc Y
            phyloNode.children = newChildren;
            setYValuesRecursively(phyloNode, originalStartingY);
            const new_corr = calculatePearsonCorrelationCoefficient(phylotree1, phylotree2);
            if (new_corr > innerCorr) {
              innerCorr = new_corr;
              bestChildren = [...newChildren];
            }
          }

          // set (potentially) new bestChildren as children and recalculate calues
          phyloNode.children = bestChildren;
          setYValuesRecursively(phyloNode, originalStartingY);
        }
        correlation = calculatePearsonCorrelationCoefficient(phylotree1, phylotree2);


      }
      //
      // /* step 2: reverse the children, recalc the y-values, and see if things improved */
      // phyloNode.children.reverse();
      // // if (phyloNode.children.length > 2) {console.log(phyloNode.children.length);}
      // // reduxNode.children.reverse();
      // setYValuesRecursively(phyloNode, originalStartingY);
      // const new_corr = calculatePearsonCorrelationCoefficient(phylotree1, phylotree2);
      // if (correlation > new_corr) {
      //   phyloNode.children.reverse();
      //   // reduxNode.children.reverse();
      //   setYValuesRecursively(phyloNode, originalStartingY);
      //   // setYValuesRecursively(phylotree2.nodes[0], 0);
      // } else {
      //   correlation = new_corr;
      // }
    }
  }
};

export const untangleTreeToo = (phylotree1, phylotree2) => {
  console.time("untangle");
  let init_corr = calculatePearsonCorrelationCoefficient(phylotree1, phylotree2);
  flipChildrenPostorder(phylotree1, phylotree2);
  console.log(`Untangling ${init_corr} -> ${calculatePearsonCorrelationCoefficient(phylotree1, phylotree2)}`);

  init_corr = calculatePearsonCorrelationCoefficient(phylotree1, phylotree2);
  flipChildrenPostorder(phylotree2, phylotree1);
  console.log(`Untangling ${init_corr} -> ${calculatePearsonCorrelationCoefficient(phylotree1, phylotree2)}`);

  setYValues(phylotree2.nodes);
  setYValues(phylotree1.nodes);

  console.timeEnd("untangle");
};