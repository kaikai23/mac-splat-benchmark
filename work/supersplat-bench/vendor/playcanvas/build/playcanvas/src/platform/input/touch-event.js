function getTouchTargetCoords(touch) {
		var totalOffsetX = 0;
		var totalOffsetY = 0;
		var target = touch.target;
		while(!(target instanceof HTMLElement) && target){
				target = target.parentNode;
		}
		while(target){
				totalOffsetX += target.offsetLeft - target.scrollLeft;
				totalOffsetY += target.offsetTop - target.scrollTop;
				target = target.offsetParent;
		}
		return {
				x: touch.pageX - totalOffsetX,
				y: touch.pageY - totalOffsetY
		};
}
class Touch {
		constructor(touch){
				var coords = getTouchTargetCoords(touch);
				this.id = touch.identifier;
				this.x = coords.x;
				this.y = coords.y;
				this.target = touch.target;
				this.touch = touch;
		}
}
class TouchEvent {
		getTouchById(id, list) {
				return list.find((touch)=>touch.id === id) || null;
		}
		constructor(device, event){
				this.touches = [];
				this.changedTouches = [];
				this.element = event.target;
				this.event = event;
				this.touches = Array.from(event.touches).map((touch)=>new Touch(touch));
				this.changedTouches = Array.from(event.changedTouches).map((touch)=>new Touch(touch));
		}
}

export { Touch, TouchEvent, getTouchTargetCoords };
