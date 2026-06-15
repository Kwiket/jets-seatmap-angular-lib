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
});
