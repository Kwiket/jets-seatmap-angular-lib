import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsTailComponent } from './jets-tail.component';

describe('JetsTailComponent', () => {
  let fixture: ComponentFixture<JetsTailComponent>;
  let component: JetsTailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsTailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsTailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render at the provided width', () => {
    component.width = 320;
    fixture.detectChanges();
    expect(component.width).toBe(320);
  });

  it('should paint the tail with fuselageFillColor', () => {
    fixture.componentRef.setInput('colorTheme', { fuselageFillColor: '#abcdef' });
    fixture.detectChanges();
    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('#abcdef');
  });

  it('should scale stroke-width by fuselageStrokeWidth', () => {
    fixture.componentRef.setInput('width', 200);
    fixture.componentRef.setInput('colorTheme', { fuselageStrokeWidth: 18 });
    fixture.detectChanges();
    // width=200 with viewBox 200 → scale factor 1, so stroke renders as 18 SVG units
    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('stroke-width:18');
  });

  // Horizontal tail direction — mirrors React Tail/index.js:55
  //   transform = isHorizontal && !rightToLeft ? 'rotate(180deg)' : ''
  const tailEl = () => fixture.nativeElement.querySelector('.jets-tail') as HTMLElement;

  it('does not rotate the tail in vertical mode', () => {
    fixture.componentRef.setInput('horizontal', false);
    fixture.detectChanges();
    expect(tailEl().style.transform).not.toContain('rotate');
  });

  it('rotates the tail 180deg in horizontal LTR mode', () => {
    fixture.componentRef.setInput('horizontal', true);
    fixture.componentRef.setInput('rightToLeft', false);
    fixture.detectChanges();
    expect(tailEl().style.transform).toContain('rotate(180deg)');
  });

  it('does not rotate the tail in horizontal RTL mode', () => {
    fixture.componentRef.setInput('horizontal', true);
    fixture.componentRef.setInput('rightToLeft', true);
    fixture.detectChanges();
    expect(tailEl().style.transform).not.toContain('rotate');
  });

  it('scales the tail up to close the fuselage join', () => {
    fixture.componentRef.setInput('width', 360);
    fixture.componentRef.setInput('colorTheme', { fuselageStrokeWidth: 4 });
    fixture.detectChanges();
    const t = tailEl().style.transform;
    expect(t).toContain('scale(');
    const scale = Number(t.match(/scale\(([^)]+)\)/)?.[1]);
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThan(1.05);
  });
});
