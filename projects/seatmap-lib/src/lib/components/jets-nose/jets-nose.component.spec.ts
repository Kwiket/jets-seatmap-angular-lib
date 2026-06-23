import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsNoseComponent } from './jets-nose.component';

describe('JetsNoseComponent', () => {
  let fixture: ComponentFixture<JetsNoseComponent>;
  let component: JetsNoseComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsNoseComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsNoseComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render with default noseType', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('should accept noseType="by-type"', () => {
    component.noseType = 'by-type';
    fixture.detectChanges();
    expect(component.noseType).toBe('by-type');
  });

  it('should respect the width input', () => {
    component.width = 480;
    fixture.detectChanges();
    expect(component.width).toBe(480);
  });

  it('should paint the nose with fuselageFillColor', () => {
    fixture.componentRef.setInput('colorTheme', { fuselageFillColor: '#abcdef' });
    fixture.detectChanges();
    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('#abcdef');
  });

  it('should scale stroke-width by fuselageStrokeWidth', () => {
    fixture.componentRef.setInput('width', 200);
    fixture.componentRef.setInput('colorTheme', { fuselageStrokeWidth: 18 });
    fixture.detectChanges();
    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('stroke-width:18');
  });

  // Horizontal nose direction — mirrors React Nose/index.js:41
  //   transform = isHorizontal && !rightToLeft ? 'rotate(180deg)' : ''
  const noseEl = () => fixture.nativeElement.querySelector('.jets-nose') as HTMLElement;

  it('does not rotate the nose in vertical mode', () => {
    fixture.componentRef.setInput('horizontal', false);
    fixture.detectChanges();
    expect(noseEl().style.transform).toBe('');
  });

  it('rotates the nose 180deg in horizontal LTR mode (nose flips to point left)', () => {
    fixture.componentRef.setInput('horizontal', true);
    fixture.componentRef.setInput('rightToLeft', false);
    fixture.detectChanges();
    expect(noseEl().style.transform).toBe('rotate(180deg)');
  });

  it('does not rotate the nose in horizontal RTL mode', () => {
    fixture.componentRef.setInput('horizontal', true);
    fixture.componentRef.setInput('rightToLeft', true);
    fixture.detectChanges();
    expect(noseEl().style.transform).toBe('');
  });
});
