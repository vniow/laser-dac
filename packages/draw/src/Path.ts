import { Shape } from './Shape';
import { Point, Color } from './Point';
import { Line } from './Line';
import { Curve } from './Curve';
import { SVGPathData } from 'svg-pathdata';
import { CommandM, CommandS, CommandC } from 'svg-pathdata/lib/types';

interface PathOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: Color;
  path: string;
}

export class Path extends Shape {
  x: number;
  y: number;
  width: number;
  height: number;
  color: Color;
  // Example: "M0.67 0 L0.33 0.88 L1 0.88 Z" draws a triangle
  // Works exactly like SVG path. Learn everything about it: https://css-tricks.com/svg-path-syntax-illustrated-guide/
  path: string;

  constructor(options: PathOptions) {
    super();
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 1;
    this.height = options.height || 1;
    this.color = options.color;
    this.path = options.path;
    // TODO: Use x,y as offset
  }

  draw(resolution: number) {
    const pathData = new SVGPathData(this.path).toAbs().transform(command => {
      if ('x' in command) {
        command.x = command.x / this.width;
      }
      if ('y' in command) {
        command.y = command.y / this.height;
      }
      return command;
    });

    if (!pathData.commands.length) {
      return [];
    }

    // The path can end by going to back to the first drawn line
    let lastMoveCommand: CommandM | undefined;
    let lastCurveCommand: CommandS | CommandC | undefined;
    // Keep track of where the last line was drawn so relative positions work
    let prevX = 0;
    let prevY = 0;

    const points = pathData.commands.map(command => {
      let commandPoints: Point[] = [];

      switch (command.type) {
        case SVGPathData.MOVE_TO:
          commandPoints.push(new Point(command.x, command.y));
          lastMoveCommand = command;
          prevX = command.x;
          prevY = command.y;
          break;

        case SVGPathData.HORIZ_LINE_TO:
        case SVGPathData.VERT_LINE_TO:
        case SVGPathData.LINE_TO:
          const toX = 'x' in command ? command.x : prevX;
          const toY = 'y' in command ? command.y : prevY;
          commandPoints = new Line({
            from: { x: prevX, y: prevY },
            to: { x: toX, y: toY },
            color: this.color
          }).draw(resolution);
          prevX = toX;
          prevY = toY;
          break;

        case SVGPathData.CURVE_TO:
          commandPoints = new Curve({
            from: {
              x: prevX,
              y: prevY,
              control: { x: command.x1, y: command.y1 }
            },
            to: {
              x: command.x,
              y: command.y,
              control: { x: command.x2, y: command.y2 }
            },
            color: this.color
          }).draw(resolution);
          prevX = command.x;
          prevY = command.y;
          lastCurveCommand = command;
          break;

        case SVGPathData.SMOOTH_CURVE_TO:
          if (!lastCurveCommand) {
            throw new Error(
              'Path parsing error: smooth curve command called without a prior curve command.'
            );
          }
          commandPoints = new Curve({
            from: {
              x: prevX,
              y: prevY,
              control: { x: lastCurveCommand.x2, y: lastCurveCommand.y2 }
            },
            to: {
              x: command.x,
              y: command.y,
              control: { x: command.x2, y: command.y2 }
            },
            color: this.color
          }).draw(resolution);
          prevX = command.x;
          prevY = command.y;
          lastCurveCommand = command;
          break;

        case SVGPathData.CLOSE_PATH:
          if (!lastMoveCommand) {
            throw new Error(
              'Path parsing error: close path command called without a prior move command.'
            );
          }
          commandPoints = new Line({
            from: { x: prevX, y: prevY },
            to: { x: lastMoveCommand.x, y: lastMoveCommand.y },
            color: this.color
          }).draw(resolution);
          prevX = lastMoveCommand.x;
          prevY = lastMoveCommand.y;
          break;
      }

      return commandPoints;
    });

    // Flatten points array.
    return points.reduce((flat, commandPoints) => flat.concat(commandPoints));
  }
}
