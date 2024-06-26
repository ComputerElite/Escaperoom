class Node {
    id = -1
    selected = false
    type = "node"
    connectedWith = []
    htmlElement = null
    generatesSignal = false

    constructor(htmlElement) {
        this.htmlElement = htmlElement
        this.id = htmlElement.id,
        this.selected = false,
        this.type = htmlElement.getAttribute("type") ?? "node"
        this.connectedWith = htmlElement.hasAttribute("connectedWith") ? htmlElement.getAttribute("connectedWith").split(",") : []
    }

    getGeneratedSignal() {
        return {}
    }

    renderNode() {
        let classes = "node "
        if(this.selected) classes += "selected "
        this.htmlElement.className = classes
    }

    getConnectedCables() {
        let cables = []
        for(const to of this.connectedWith) {
            cables.push({from: this.id, to: to, mutable: false, oneway: false})
        }
        return cables
    }

    feedSignal(input) {
        return input
    }

    offsetLeft() {
        return this.htmlElement.offsetLeft
    }

    offsetTop() {
        return this.htmlElement.offsetTop
    }

    offsetX() {
        return this.htmlElement.offsetX
    }

    offsetY() {
        return this.htmlElement.offsetY
    }
}

class PowerNode extends Node {
    generatesSignal = true


    getGeneratedSignal() {
        return {active: true}
    }

    renderNode() {
        let classes = "node "
        if(this.selected) classes += "selected "
        classes += "power "
        this.htmlElement.className = classes
    }


    feedSignal(input) {
        return this.getGeneratedSignal()
    }
}

class LightNode extends Node {

    renderNode() {
        let classes = "node "
        if(this.selected) classes += "selected "
        classes += "light " + (GetSignal(this.id).active ? "lightActive " : "")
        this.htmlElement.className = classes
    }
}

class SinusNode extends Node {
    feedSignal(signal) {
        if(signal.active) return {
            active: true,
            sinFrequency: 1,
            sinOffset: 10,
            sinAmplitude: 50,
            sin: true
        }
        return signal
    }
}

class ModifyNode extends Node {
    modifySignalValue = ""
    sliderInput = null

    constructor(htmlElement) {
        super(htmlElement)
        this.modifySignalValue = htmlElement.getAttribute("modifySignalValue")
        this.sliderInput = document.getElementById(htmlElement.getAttribute("sliderId"))
        this.sliderInput.onchange = () => {
            UpdateSignalsAndUI()
        }
        this.sliderInput.oninput = () => {
            
            UpdateSignalsAndUI()
        }
    }
    feedSignal(signal) {
        console.log("before ")
        console.log(signal)
        console.log("slider " + this.sliderInput.value)
        if(signal[this.modifySignalValue]) {

            signal[this.modifySignalValue] *= this.sliderInput.value
            console.log("after " + signal[this.modifySignalValue])
        }
        return signal
    }
}

class DisplayNode extends Node {
    canvasId = ""
    canvas = null
    ctx = null

    constructor(htmlElement) {
        super(htmlElement)
        this.canvasId = htmlElement.getAttribute("canvasId")
        this.canvas = document.getElementById(this.canvasId)
        this.ctx = this.canvas.getContext("2d");
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = "#EE0000"
    }

    renderNode() {
        let classes = "node "
        if(this.selected) classes += "selected "
        let signal = GetSignal(this.id)
        this.htmlElement.className = classes
        this.clearCanvas()
        if(signal.sin) {
            this.renderCanvas(x => Math.sin(x*signal.sinFrequency+signal.sinOffset)*signal.sinAmplitude)
        }
        else if(signal.active) this.renderCanvas(x => 1)
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    }

    renderCanvas(f) {
        this.ctx.beginPath()
        this.ctx.moveTo(0, this.correctYValue(f(0)))
    
        for(let x = 0; x < this.canvas.width; x++) {
            this.ctx.lineTo(x, this.correctYValue(f(this.mapX(x))))
        }
        this.ctx.stroke()
    }

    mapX(x) {
        return (x-this.canvas.width / 2) / this.canvas.width * 2 * 10
    }

    correctYValue(y) {
        return y + this.canvas.height / 2
    }
}

function CopySignal(obj) {
    return JSON.parse(JSON.stringify(obj))
}

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.lineWidth = 3;
ctx.strokeStyle = "#EE0000"

var offsetX = canvas.offsetLeft;
var offsetY = canvas.offsetTop;

var nodes = []
var selectedState = []
let signals = {}
var connectedCables = []
for(const e of document.getElementsByClassName("node")) {
    e.onclick = (e) => {
        OnNodeClicked(e.target.id)
    }
    let n = GetCorrectNodeType(new Node(e));
    nodes.push(n)
    connectedCables.push(...n.getConnectedCables())
}
RenderUI()

function GetCorrectNodeType(node) {
    switch(node.type) {
        case "node":
            return node
        case "power":
            return new PowerNode(node.htmlElement)
        case "light":
            return new LightNode(node.htmlElement)
        case "display":
            return new DisplayNode(node.htmlElement)
        case "sin":
            return new SinusNode(node.htmlElement)
        case "modify":
            return new ModifyNode(node.htmlElement)
    }
}


function UpdateNode(id, action) {
    for(const e of nodes) {
        if(e.id == id) {
            action(e)
        }
    }
}

function OnNodeClicked(id) {
    if(document.getElementById(id).hasAttribute("disabled")) return
    UpdateNode(id, e => e.selected = !e.selected)
    CheckConnections()
    UpdateSignalsAndUI()
}

function UpdateSignalsAndUI() {

    SendSignal()
    RenderUI()
}

function SendSignal() {
    // lol
    power = nodes.filter(x => x.generatesSignal)
    signals = {}
    for(const p of power) {
        signals[p.id] = p.getGeneratedSignal()
    }
    for(let i = 0; i < connectedCables.length * 1.5; i++) {
        Step()
        // ToDo: step only the required amount of times
    }

}


function Step() {
    for(const [key, value] of Object.entries(signals)) {
        let connections = connectedCables.filter(x => x.from == key || x.to == key)
        if(connections.length <= 0) continue;
        for(const c of connections) {
            let targetId = c.to == key ? c.from : c.to
            signals[targetId] = nodes.find(x => x.id == targetId).feedSignal(CopySignal(value)) // give forward value to next node
        }
    }
}

function GetSelectedNodes() {
    return nodes.filter(x => x.selected)
}

function CheckConnections() {
    let selectedNodes = GetSelectedNodes()
    for(let i = 0; i < connectedCables.length; i++) {
        if(connectedCables[i].mutable && selectedNodes.some(x => x.id == connectedCables[i].from || x.id == connectedCables[i].to)) {
            connectedCables.splice(i)
            i--;
        }
    }
                
    if(selectedNodes.length >= 2) {
        connectedCables.push({from: selectedNodes[0].id, to: selectedNodes[1].id, mutable: true, oneway: false})
        UpdateNode(selectedNodes[0].id, x => x.selected = false)
        UpdateNode(selectedNodes[1].id, x => x.selected = false)

    }
}

function GetSignal(id) {
    return signals[id] ?? {}
}

function RenderUI() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for(const e of nodes) {
        e.renderNode()
    }
    for (var i = 0; i < connectedCables.length; i++) {
        var c = connectedCables[i];
        let from = document.getElementById(c.from)
        let to = document.getElementById(c.to)
        ctx.beginPath();
        let fromX = from.offsetLeft + from.clientWidth / 2 - canvas.offsetLeft
        let fromY = from.offsetTop + from.clientHeight / 2 - canvas.offsetTop
        let toX = to.offsetLeft + to.clientWidth / 2- canvas.offsetLeft
        let toY = to.offsetTop + to.clientHeight / 2- canvas.offsetTop
        ctx.strokeStyle = c.mutable ? "#FF0000" : "#00FF00"
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
    }
}