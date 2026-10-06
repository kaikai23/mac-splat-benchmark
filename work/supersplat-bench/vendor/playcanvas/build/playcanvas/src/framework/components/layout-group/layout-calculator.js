import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../../scene/constants.js';
import { FITTING_SHRINK, FITTING_BOTH, FITTING_STRETCH, FITTING_NONE } from './constants.js';

var AXIS_MAPPINGS = {};
AXIS_MAPPINGS[ORIENTATION_HORIZONTAL] = {
		axis: 'x',
		size: 'width',
		calculatedSize: 'calculatedWidth',
		minSize: 'minWidth',
		maxSize: 'maxWidth',
		fitting: 'widthFitting',
		fittingProportion: 'fitWidthProportion'
};
AXIS_MAPPINGS[ORIENTATION_VERTICAL] = {
		axis: 'y',
		size: 'height',
		calculatedSize: 'calculatedHeight',
		minSize: 'minHeight',
		maxSize: 'maxHeight',
		fitting: 'heightFitting',
		fittingProportion: 'fitHeightProportion'
};
var OPPOSITE_ORIENTATION = {};
OPPOSITE_ORIENTATION[ORIENTATION_HORIZONTAL] = ORIENTATION_VERTICAL;
OPPOSITE_ORIENTATION[ORIENTATION_VERTICAL] = ORIENTATION_HORIZONTAL;
var PROPERTY_DEFAULTS = {
		minWidth: 0,
		minHeight: 0,
		maxWidth: Number.POSITIVE_INFINITY,
		maxHeight: Number.POSITIVE_INFINITY,
		width: null,
		height: null,
		fitWidthProportion: 0,
		fitHeightProportion: 0
};
var FITTING_ACTION = {
		NONE: 'NONE',
		APPLY_STRETCHING: 'APPLY_STRETCHING',
		APPLY_SHRINKING: 'APPLY_SHRINKING'
};
var availableSpace = new Vec2();
function createCalculator(orientation) {
		var options;
		var a = AXIS_MAPPINGS[orientation];
		var b = AXIS_MAPPINGS[OPPOSITE_ORIENTATION[orientation]];
		function minExtentA(element, size) {
				return -size[a.size] * element.pivot[a.axis];
		}
		function minExtentB(element, size) {
				return -size[b.size] * element.pivot[b.axis];
		}
		function maxExtentA(element, size) {
				return size[a.size] * (1 - element.pivot[a.axis]);
		}
		function calculateAll(allElements, layoutOptions) {
				allElements = allElements.filter(shouldIncludeInLayout);
				options = layoutOptions;
				availableSpace.x = options.containerSize.x - options.padding.x - options.padding.z;
				availableSpace.y = options.containerSize.y - options.padding.y - options.padding.w;
				resetAnchors(allElements);
				var lines = reverseLinesIfRequired(splitLines(allElements));
				var sizes = calculateSizesOnAxisB(lines, calculateSizesOnAxisA(lines));
				var positions = calculateBasePositions(lines, sizes);
				applyAlignmentAndPadding(lines, sizes, positions);
				applySizesAndPositions(lines, sizes, positions);
				return createLayoutInfo(lines);
		}
		function shouldIncludeInLayout(element) {
				var layoutChildComponent = element.entity.layoutchild;
				return !layoutChildComponent || !layoutChildComponent.enabled || !layoutChildComponent.excludeFromLayout;
		}
		function resetAnchors(allElements) {
				for(var i = 0; i < allElements.length; ++i){
						var element = allElements[i];
						var anchor = element.anchor;
						if (anchor.x !== 0 || anchor.y !== 0 || anchor.z !== 0 || anchor.w !== 0) {
								element.anchor = Vec4.ZERO;
						}
				}
		}
		function splitLines(allElements) {
				if (!options.wrap) {
						return [
								allElements
						];
				}
				var lines = [
						[]
				];
				var sizes = getElementSizeProperties(allElements);
				var runningSize = 0;
				var allowOverrun = options[a.fitting] === FITTING_SHRINK;
				for(var i = 0; i < allElements.length; ++i){
						if (lines[lines.length - 1].length > 0) {
								runningSize += options.spacing[a.axis];
						}
						var idealElementSize = sizes[i][a.size];
						runningSize += idealElementSize;
						if (!allowOverrun && runningSize > availableSpace[a.axis] && lines[lines.length - 1].length !== 0) {
								runningSize = idealElementSize;
								lines.push([]);
						}
						lines[lines.length - 1].push(allElements[i]);
						if (allowOverrun && runningSize > availableSpace[a.axis] && i !== allElements.length - 1) {
								runningSize = 0;
								lines.push([]);
						}
				}
				return lines;
		}
		function reverseLinesIfRequired(lines) {
				var reverseAxisA = options.orientation === ORIENTATION_HORIZONTAL && options.reverseX || options.orientation === ORIENTATION_VERTICAL && options.reverseY;
				var reverseAxisB = options.orientation === ORIENTATION_HORIZONTAL && options.reverseY || options.orientation === ORIENTATION_VERTICAL && options.reverseX;
				if (reverseAxisA) {
						for(var lineIndex = 0; lineIndex < lines.length; ++lineIndex){
								if (reverseAxisA) {
										lines[lineIndex].reverse();
								}
						}
				}
				if (reverseAxisB) {
						lines.reverse();
				}
				return lines;
		}
		function calculateSizesOnAxisA(lines) {
				var sizesAllLines = [];
				for(var lineIndex = 0; lineIndex < lines.length; ++lineIndex){
						var line = lines[lineIndex];
						var sizesThisLine = getElementSizeProperties(line);
						var idealRequiredSpace = calculateTotalSpace(sizesThisLine, a);
						var fittingAction = determineFittingAction(options[a.fitting], idealRequiredSpace, availableSpace[a.axis]);
						if (fittingAction === FITTING_ACTION.APPLY_STRETCHING) {
								stretchSizesToFitContainer(sizesThisLine, idealRequiredSpace, a);
						} else if (fittingAction === FITTING_ACTION.APPLY_SHRINKING) {
								shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace, a);
						}
						sizesAllLines.push(sizesThisLine);
				}
				return sizesAllLines;
		}
		function calculateSizesOnAxisB(lines, sizesAllLines) {
				var largestElementsForEachLine = [];
				var largestSizesForEachLine = [];
				for(var lineIndex = 0; lineIndex < lines.length; ++lineIndex){
						var line = lines[lineIndex];
						line.largestElement = null;
						line.largestSize = {
								width: Number.NEGATIVE_INFINITY,
								height: Number.NEGATIVE_INFINITY
						};
						for(var elementIndex = 0; elementIndex < line.length; ++elementIndex){
								var sizesThisElement = sizesAllLines[lineIndex][elementIndex];
								if (sizesThisElement[b.size] > line.largestSize[b.size]) {
										line.largestElement = line[elementIndex];
										line.largestSize = sizesThisElement;
								}
						}
						largestElementsForEachLine.push(line.largestElement);
						largestSizesForEachLine.push(line.largestSize);
				}
				var idealRequiredSpace = calculateTotalSpace(largestSizesForEachLine, b);
				var fittingAction = determineFittingAction(options[b.fitting], idealRequiredSpace, availableSpace[b.axis]);
				if (fittingAction === FITTING_ACTION.APPLY_STRETCHING) {
						stretchSizesToFitContainer(largestSizesForEachLine, idealRequiredSpace, b);
				} else if (fittingAction === FITTING_ACTION.APPLY_SHRINKING) {
						shrinkSizesToFitContainer(largestSizesForEachLine, idealRequiredSpace, b);
				}
				for(var lineIndex1 = 0; lineIndex1 < lines.length; ++lineIndex1){
						var line1 = lines[lineIndex1];
						for(var elementIndex1 = 0; elementIndex1 < line1.length; ++elementIndex1){
								var sizesForThisElement = sizesAllLines[lineIndex1][elementIndex1];
								var currentSize = sizesForThisElement[b.size];
								var availableSize = lines.length === 1 ? availableSpace[b.axis] : line1.largestSize[b.size];
								var elementFittingAction = determineFittingAction(options[b.fitting], currentSize, availableSize);
								if (elementFittingAction === FITTING_ACTION.APPLY_STRETCHING) {
										sizesForThisElement[b.size] = Math.min(availableSize, sizesForThisElement[b.maxSize]);
								} else if (elementFittingAction === FITTING_ACTION.APPLY_SHRINKING) {
										sizesForThisElement[b.size] = Math.max(availableSize, sizesForThisElement[b.minSize]);
								}
						}
				}
				return sizesAllLines;
		}
		function determineFittingAction(fittingMode, currentSize, availableSize) {
				switch(fittingMode){
						case FITTING_NONE:
								return FITTING_ACTION.NONE;
						case FITTING_STRETCH:
								if (currentSize < availableSize) {
										return FITTING_ACTION.APPLY_STRETCHING;
								}
								return FITTING_ACTION.NONE;
						case FITTING_SHRINK:
								if (currentSize >= availableSize) {
										return FITTING_ACTION.APPLY_SHRINKING;
								}
								return FITTING_ACTION.NONE;
						case FITTING_BOTH:
								if (currentSize < availableSize) {
										return FITTING_ACTION.APPLY_STRETCHING;
								}
								return FITTING_ACTION.APPLY_SHRINKING;
						default:
								throw new Error("Unrecognized fitting mode: " + fittingMode);
				}
		}
		function calculateTotalSpace(sizes, axis) {
				var totalSizes = sumValues(sizes, axis.size);
				var totalSpacing = (sizes.length - 1) * options.spacing[axis.axis];
				return totalSizes + totalSpacing;
		}
		function stretchSizesToFitContainer(sizesThisLine, idealRequiredSpace, axis) {
				var ascendingMaxSizeOrder = getTraversalOrder(sizesThisLine, axis.maxSize);
				var fittingProportions = getNormalizedValues(sizesThisLine, axis.fittingProportion);
				var fittingProportionSums = createSumArray(fittingProportions, ascendingMaxSizeOrder);
				var remainingUndershoot = availableSpace[axis.axis] - idealRequiredSpace;
				for(var i = 0; i < sizesThisLine.length; ++i){
						var index = ascendingMaxSizeOrder[i];
						var targetIncrease = calculateAdjustment(index, remainingUndershoot, fittingProportions, fittingProportionSums);
						var targetSize = sizesThisLine[index][axis.size] + targetIncrease;
						var maxSize = sizesThisLine[index][axis.maxSize];
						var actualSize = Math.min(targetSize, maxSize);
						sizesThisLine[index][axis.size] = actualSize;
						var actualIncrease = Math.max(targetSize - actualSize, 0);
						var appliedIncrease = targetIncrease - actualIncrease;
						remainingUndershoot -= appliedIncrease;
				}
		}
		function shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace, axis) {
				var descendingMinSizeOrder = getTraversalOrder(sizesThisLine, axis.minSize, true);
				var fittingProportions = getNormalizedValues(sizesThisLine, axis.fittingProportion);
				var inverseFittingProportions = invertNormalizedValues(fittingProportions);
				var inverseFittingProportionSums = createSumArray(inverseFittingProportions, descendingMinSizeOrder);
				var remainingOvershoot = idealRequiredSpace - availableSpace[axis.axis];
				for(var i = 0; i < sizesThisLine.length; ++i){
						var index = descendingMinSizeOrder[i];
						var targetReduction = calculateAdjustment(index, remainingOvershoot, inverseFittingProportions, inverseFittingProportionSums);
						var targetSize = sizesThisLine[index][axis.size] - targetReduction;
						var minSize = sizesThisLine[index][axis.minSize];
						var actualSize = Math.max(targetSize, minSize);
						sizesThisLine[index][axis.size] = actualSize;
						var actualReduction = Math.max(actualSize - targetSize, 0);
						var appliedReduction = targetReduction - actualReduction;
						remainingOvershoot -= appliedReduction;
				}
		}
		function calculateAdjustment(index, remainingAdjustment, fittingProportions, fittingProportionSums) {
				var proportion = fittingProportions[index];
				var sumOfRemainingProportions = fittingProportionSums[index];
				if (Math.abs(proportion) < 1e-5 && Math.abs(sumOfRemainingProportions) < 1e-5) {
						return remainingAdjustment;
				}
				return remainingAdjustment * proportion / sumOfRemainingProportions;
		}
		function calculateBasePositions(lines, sizes) {
				var cursor = {};
				cursor[a.axis] = 0;
				cursor[b.axis] = 0;
				lines[a.size] = Number.NEGATIVE_INFINITY;
				var positionsAllLines = [];
				for(var lineIndex = 0; lineIndex < lines.length; ++lineIndex){
						var line = lines[lineIndex];
						if (line.length === 0) {
								positionsAllLines.push([]);
								continue;
						}
						var positionsThisLine = [];
						var sizesThisLine = sizes[lineIndex];
						for(var elementIndex = 0; elementIndex < line.length; ++elementIndex){
								var element = line[elementIndex];
								var sizesThisElement = sizesThisLine[elementIndex];
								cursor[b.axis] -= minExtentB(element, sizesThisElement);
								cursor[a.axis] -= minExtentA(element, sizesThisElement);
								positionsThisLine[elementIndex] = {};
								positionsThisLine[elementIndex][a.axis] = cursor[a.axis];
								positionsThisLine[elementIndex][b.axis] = cursor[b.axis];
								cursor[b.axis] += minExtentB(element, sizesThisElement);
								cursor[a.axis] += maxExtentA(element, sizesThisElement) + options.spacing[a.axis];
						}
						line[a.size] = cursor[a.axis] - options.spacing[a.axis];
						line[b.size] = line.largestSize[b.size];
						lines[a.size] = Math.max(lines[a.size], line[a.size]);
						cursor[a.axis] = 0;
						cursor[b.axis] += line[b.size] + options.spacing[b.axis];
						positionsAllLines.push(positionsThisLine);
				}
				lines[b.size] = cursor[b.axis] - options.spacing[b.axis];
				return positionsAllLines;
		}
		function applyAlignmentAndPadding(lines, sizes, positions) {
				var alignmentA = options.alignment[a.axis];
				var alignmentB = options.alignment[b.axis];
				var paddingA = options.padding[a.axis];
				var paddingB = options.padding[b.axis];
				for(var lineIndex = 0; lineIndex < lines.length; ++lineIndex){
						var line = lines[lineIndex];
						var sizesThisLine = sizes[lineIndex];
						var positionsThisLine = positions[lineIndex];
						var axisAOffset = (availableSpace[a.axis] - line[a.size]) * alignmentA + paddingA;
						var axisBOffset = (availableSpace[b.axis] - lines[b.size]) * alignmentB + paddingB;
						for(var elementIndex = 0; elementIndex < line.length; ++elementIndex){
								var withinLineAxisBOffset = (line[b.size] - sizesThisLine[elementIndex][b.size]) * options.alignment[b.axis];
								positionsThisLine[elementIndex][a.axis] += axisAOffset;
								positionsThisLine[elementIndex][b.axis] += axisBOffset + withinLineAxisBOffset;
						}
				}
		}
		function applySizesAndPositions(lines, sizes, positions) {
				for(var lineIndex = 0; lineIndex < lines.length; ++lineIndex){
						var line = lines[lineIndex];
						var sizesThisLine = sizes[lineIndex];
						var positionsThisLine = positions[lineIndex];
						for(var elementIndex = 0; elementIndex < line.length; ++elementIndex){
								var element = line[elementIndex];
								element[a.calculatedSize] = sizesThisLine[elementIndex][a.size];
								element[b.calculatedSize] = sizesThisLine[elementIndex][b.size];
								if (options.orientation === ORIENTATION_HORIZONTAL) {
										element.entity.setLocalPosition(positionsThisLine[elementIndex][a.axis], positionsThisLine[elementIndex][b.axis], element.entity.getLocalPosition().z);
								} else {
										element.entity.setLocalPosition(positionsThisLine[elementIndex][b.axis], positionsThisLine[elementIndex][a.axis], element.entity.getLocalPosition().z);
								}
						}
				}
		}
		function createLayoutInfo(lines) {
				var layoutWidth = lines.width;
				var layoutHeight = lines.height;
				var xOffset = (availableSpace.x - layoutWidth) * options.alignment.x + options.padding.x;
				var yOffset = (availableSpace.y - layoutHeight) * options.alignment.y + options.padding.y;
				return {
						bounds: new Vec4(xOffset, yOffset, layoutWidth, layoutHeight)
				};
		}
		function getElementSizeProperties(elements) {
				var sizeProperties = [];
				for(var i = 0; i < elements.length; ++i){
						var element = elements[i];
						var minWidth = Math.max(getProperty(element, 'minWidth'), 0);
						var minHeight = Math.max(getProperty(element, 'minHeight'), 0);
						var maxWidth = Math.max(getProperty(element, 'maxWidth'), minWidth);
						var maxHeight = Math.max(getProperty(element, 'maxHeight'), minHeight);
						var width = clamp(getProperty(element, 'width'), minWidth, maxWidth);
						var height = clamp(getProperty(element, 'height'), minHeight, maxHeight);
						var fitWidthProportion = getProperty(element, 'fitWidthProportion');
						var fitHeightProportion = getProperty(element, 'fitHeightProportion');
						sizeProperties.push({
								minWidth: minWidth,
								minHeight: minHeight,
								maxWidth: maxWidth,
								maxHeight: maxHeight,
								width: width,
								height: height,
								fitWidthProportion: fitWidthProportion,
								fitHeightProportion: fitHeightProportion
						});
				}
				return sizeProperties;
		}
		function getProperty(element, propertyName) {
				var layoutChildComponent = element.entity.layoutchild;
				if (layoutChildComponent && layoutChildComponent.enabled && layoutChildComponent[propertyName] !== undefined && layoutChildComponent[propertyName] !== null) {
						return layoutChildComponent[propertyName];
				} else if (element[propertyName] !== undefined) {
						return element[propertyName];
				}
				return PROPERTY_DEFAULTS[propertyName];
		}
		function clamp(value, min, max) {
				return Math.min(Math.max(value, min), max);
		}
		function sumValues(items, propertyName) {
				return items.reduce((accumulator, current)=>{
						return accumulator + current[propertyName];
				}, 0);
		}
		function getNormalizedValues(items, propertyName) {
				var sum = sumValues(items, propertyName);
				var normalizedValues = [];
				var numItems = items.length;
				if (sum === 0) {
						for(var i = 0; i < numItems; ++i){
								normalizedValues.push(1 / numItems);
						}
				} else {
						for(var i1 = 0; i1 < numItems; ++i1){
								normalizedValues.push(items[i1][propertyName] / sum);
						}
				}
				return normalizedValues;
		}
		function invertNormalizedValues(values) {
				if (values.length === 1) {
						return [
								1
						];
				}
				var invertedValues = [];
				var numValues = values.length;
				for(var i = 0; i < numValues; ++i){
						invertedValues.push((1 - values[i]) / (numValues - 1));
				}
				return invertedValues;
		}
		function getTraversalOrder(items, orderBy, descending) {
				items.forEach(assignIndex);
				return items.slice().sort((itemA, itemB)=>{
						return descending ? itemB[orderBy] - itemA[orderBy] : itemA[orderBy] - itemB[orderBy];
				}).map(getIndex);
		}
		function assignIndex(item, index) {
				item.index = index;
		}
		function getIndex(item) {
				return item.index;
		}
		function createSumArray(values, order) {
				var sumArray = [];
				sumArray[order[values.length - 1]] = values[order[values.length - 1]];
				for(var i = values.length - 2; i >= 0; --i){
						sumArray[order[i]] = sumArray[order[i + 1]] + values[order[i]];
				}
				return sumArray;
		}
		return calculateAll;
}
var CALCULATE_FNS = {};
CALCULATE_FNS[ORIENTATION_HORIZONTAL] = createCalculator(ORIENTATION_HORIZONTAL);
CALCULATE_FNS[ORIENTATION_VERTICAL] = createCalculator(ORIENTATION_VERTICAL);
class LayoutCalculator {
		calculateLayout(elements, options) {
				var calculateFn = CALCULATE_FNS[options.orientation];
				if (!calculateFn) {
						throw new Error("Unrecognized orientation value: " + options.orientation);
				} else {
						return calculateFn(elements, options);
				}
		}
}

export { LayoutCalculator };
