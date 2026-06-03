import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsBulkComponent } from './jets-bulk.component';

describe('JetsBulkComponent', () => {
  let fixture: ComponentFixture<JetsBulkComponent>;
  let component: JetsBulkComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsBulkComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsBulkComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should accept an empty bulks array', () => {
    component.bulks = [];
    fixture.detectChanges();
    expect(component.bulks).toEqual([]);
  });

  it('should accept a populated bulks array', () => {
    component.bulks = [{ id: 'b1', type: 1, width: 50, height: 50, topOffset: 0, align: 'left' }];
    fixture.detectChanges();
    expect(component.bulks).toHaveLength(1);
  });

  it('should respect scale and topAdjust inputs', () => {
    component.scale = 1.5;
    component.topAdjust = 12;
    fixture.detectChanges();
    expect(component.scale).toBeCloseTo(1.5);
    expect(component.topAdjust).toBe(12);
  });

  // ─── flatBulks — pseudo-3D vs single-color rendering ──────────────────
  //
  // Default (flatBulks=false): the bulk SVG keeps two distinct fills —
  // bulkBaseColor for the larger lower body and bulkCutColor for the thin
  // top strip — producing the pseudo-3D illusion.
  //
  // flatBulks=true: both halves are painted with bulkCutColor, so the
  // visible split disappears while the outer contour stays the same.

  describe('flatBulks', () => {
    const SAMPLE_BULK = {
      id: '1',
      type: 1,
      width: 100,
      height: 30,
      topOffset: 0,
      align: 'left' as const,
    };

    it('default renders both base and cut colors', () => {
      component.bulks = [SAMPLE_BULK];
      component.colorTheme = { bulkBaseColor: '#111111', bulkCutColor: '#eeeeee' };
      component.ngOnChanges();
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('.jets-bulk__icon')?.innerHTML ?? '';
      expect(svg).toContain('#111111');
      expect(svg).toContain('#eeeeee');
    });

    it('flatBulks=true paints both halves with the cut color', () => {
      component.bulks = [SAMPLE_BULK];
      component.colorTheme = { bulkBaseColor: '#111111', bulkCutColor: '#eeeeee' };
      component.flatBulks = true;
      component.ngOnChanges();
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('.jets-bulk__icon')?.innerHTML ?? '';
      expect(svg).not.toContain('#111111');
      // Both bulk-base and bulk-cut paths should now use cutColor.
      const matches = svg.match(/#eeeeee/gi) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('flatBulks defaults to false', () => {
      expect(component.flatBulks).toBe(false);
    });
  });
});
