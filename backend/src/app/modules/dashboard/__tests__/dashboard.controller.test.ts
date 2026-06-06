import type { Request, Response } from 'express';
import { dashboardController } from '../dashboard.controller';
import { dashboardService } from '../dashboard.service';
import { ApiError } from '../../../errors/ApiError';

const mockRes = () => {
  const res = {} as Partial<Response> & { _status?: number; _body?: unknown };
  res.status = jest.fn().mockImplementation((s: number) => {
    res._status = s;
    return res as Response;
  });
  res.json = jest.fn().mockImplementation((b: unknown) => {
    res._body = b;
    return res as Response;
  });
  return res as Response & { _status?: number; _body?: unknown };
};

const mkReq = (overrides: Partial<Request> = {}): Request =>
  ({
    user: { id: 'u-1', email: 'a@x.co', role: 'admin' },
    params: {},
    query: {},
    ...overrides,
  }) as unknown as Request;

describe('dashboardController', () => {
  afterEach(() => jest.restoreAllMocks());

  it('kpis returns 200 + body', async () => {
    jest.spyOn(dashboardService, 'getKpis').mockResolvedValue({
      totalProjects: 1,
      totalTasks: 2,
      completedTasks: 1,
      completionPct: 50,
      myOpenTasks: 1,
      myCompletedTasks: 0,
      myCompletionPct: 0,
    });
    const res = mockRes();
    const next = jest.fn();
    await dashboardController.kpis(mkReq(), res, next);
    expect(res._status).toBe(200);
    expect(res._body).toMatchObject({ totalProjects: 1 });
    expect(next).not.toHaveBeenCalled();
  });

  it('kpis no req.user → calls next(ApiError 401)', async () => {
    const res = mockRes();
    const next = jest.fn();
    await dashboardController.kpis({ params: {}, query: {} } as unknown as Request, res, next);
    expect(next).toHaveBeenCalled();
    expect((next.mock.calls[0][0] as ApiError).statusCode).toBe(401);
  });

  it('status returns 200', async () => {
    jest.spyOn(dashboardService, 'getStatusCounts').mockResolvedValue({ todo: 0, in_progress: 0, completed: 0 });
    const res = mockRes();
    await dashboardController.status(mkReq(), res, jest.fn());
    expect(res._status).toBe(200);
  });

  it('priority returns 200', async () => {
    jest.spyOn(dashboardService, 'getPriorityCounts').mockResolvedValue({ low: 0, medium: 0, high: 0 });
    const res = mockRes();
    await dashboardController.priority(mkReq(), res, jest.fn());
    expect(res._status).toBe(200);
  });

  it('productivity uses days from query and returns {data}', async () => {
    const spy = jest.spyOn(dashboardService, 'getProductivity').mockResolvedValue([]);
    const res = mockRes();
    await dashboardController.productivity(mkReq({ query: { days: 14 } as unknown as Request['query'] }), res, jest.fn());
    expect(res._status).toBe(200);
    expect(spy).toHaveBeenCalledWith(expect.anything(), 14);
    expect(res._body).toEqual({ data: [] });
  });

  it('upcoming uses days from query and returns payload directly', async () => {
    const spy = jest.spyOn(dashboardService, 'getUpcoming').mockResolvedValue({ tasks: [], projects: [] });
    const res = mockRes();
    await dashboardController.upcoming(mkReq({ query: { days: 7 } as unknown as Request['query'] }), res, jest.fn());
    expect(res._status).toBe(200);
    expect(spy).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it('highPriority returns {data}', async () => {
    jest.spyOn(dashboardService, 'getHighPriority').mockResolvedValue([]);
    const res = mockRes();
    await dashboardController.highPriority(mkReq(), res, jest.fn());
    expect(res._body).toEqual({ data: [] });
  });

  it('controller propagates service errors via next', async () => {
    jest.spyOn(dashboardService, 'getKpis').mockRejectedValue(new Error('boom'));
    const res = mockRes();
    const next = jest.fn();
    await dashboardController.kpis(mkReq(), res, next);
    expect(next).toHaveBeenCalled();
    expect(res._status).toBeUndefined();
  });
});
