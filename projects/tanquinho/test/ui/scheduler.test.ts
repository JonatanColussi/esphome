import { createFrameScheduler } from '../../src/ui/scheduler';

describe('createFrameScheduler', () => {
  it('runs the task once per frame no matter how many times it is requested', () => {
    const frames: FrameRequestCallback[] = [];
    const task = jest.fn();
    const schedule = createFrameScheduler(task, callback => frames.push(callback));

    schedule();
    schedule();
    schedule();

    expect(task).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);

    frames[0](0);

    expect(task).toHaveBeenCalledTimes(1);

    schedule();

    expect(frames).toHaveLength(2);

    frames[1](0);

    expect(task).toHaveBeenCalledTimes(2);
  });
});
